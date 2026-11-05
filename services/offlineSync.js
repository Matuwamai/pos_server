import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import inventoryService from './inventory.js';
import salesSummaryService from './salesSummary.js';
import auditLogService from './auditLog.js';
import orderService from './order.js';
import { getCurrencyDecimalDigits } from '../config/currencies.js';
import { round } from '../utils/money.js';


const uuid = z.string().uuid();
const money = z.coerce.number().nonnegative();

const ORDER_PAYLOAD = z.object({
  id: uuid,
  locationId: uuid,
  cashierId: uuid,
  cashDrawerSessionId: uuid.optional(),
  customerId: uuid.optional(),
  terminalReceiptNo: z.string().min(1).max(40),
  createdAt: z.coerce.date(),
  items: z
    .array(
      z.object({
        variantId: uuid,
        quantity: z.coerce.number().positive(),
        unitPrice: money,
        taxAmount: money,
        lineTotal: money,
        modifiers: z.array(z.object({ modifierId: uuid, priceAdjustment: z.coerce.number() })).default([]),
      })
    )
    .min(1),
  discounts: z
    .array(z.object({ promotionCode: z.string().optional(), amount: z.coerce.number().positive(), reason: z.string().max(255).optional() }))
    .default([]),
  payments: z
    .array(
      z
        .object({
          method: z.enum(['CASH', 'CARD', 'MPESA', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER']),
          amount: z.coerce.number().positive(),
          transactionRef: z.string().max(255).optional(),
          giftCardCode: z.string().optional(),
        })
        .refine((p) => p.method !== 'MPESA' || !!p.transactionRef, {
          message: 'transactionRef (the M-Pesa confirmation code) is required for MPESA payments',
          path: ['transactionRef'],
        })
        .refine((p) => p.method !== 'GIFT_CARD' || !!p.giftCardCode, {
          message: 'giftCardCode is required for GIFT_CARD payments',
          path: ['giftCardCode'],
        })
    )
    .min(1),
  subtotal: money,
  discountTotal: money,
  taxTotal: money,
  total: money,
});

const DRAWER_OPEN = z.object({ id: uuid, locationId: uuid, cashierId: uuid, openingFloat: money, openedAt: z.coerce.date() });
const DRAWER_CLOSE = z.object({ id: uuid, cashierId: uuid, closingCash: money, closedAt: z.coerce.date() });

const CUSTOMER_CREATE = z.object({
  id: uuid, 
  name: z.string().min(1).max(255),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
});

class DuplicateSale extends Error {
  constructor(orderId) {
    super('duplicate sale');
    this.orderId = orderId;
  }
}

function parsePayload(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid sync payload', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return parsed.data;
}

async function assertCashier(tx, cashierId) {
  const cashier = await tx.user.findUnique({ where: { id: cashierId } });
  if (!cashier || !cashier.isActive) throw ApiError.badRequest('Cashier is not an active user of this business');
  if (cashier.mustChangePassword) throw ApiError.badRequest('Cashier must choose a new password before selling');
  return cashier;
}

async function importOfflineOrder(tx, terminal, payload) {
  const p = parsePayload(ORDER_PAYLOAD, payload);

  if (p.locationId !== terminal.locationId) throw ApiError.badRequest('Sale belongs to a different location than this terminal');
  if (await tx.order.findUnique({ where: { id: p.id } })) throw new DuplicateSale(p.id);
  const cashier = await assertCashier(tx, p.cashierId);
  const location = await tx.location.findUnique({ where: { id: p.locationId } });
  if (!location) throw ApiError.badRequest('Unknown location');

  if (p.cashDrawerSessionId) {
    const session = await tx.cashDrawerSession.findUnique({ where: { id: p.cashDrawerSessionId } });
    if (!session || session.locationId !== p.locationId) throw ApiError.badRequest('Cash drawer session not found at this location');
  }

  const tenant = await tx.tenant.findUnique({ where: { id: terminal.tenantId }, select: { currency: true } });
  const tenantCurrency = tenant.currency;
  const decimalDigits = getCurrencyDecimalDigits(tenantCurrency);
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of p.items) {
    const lineSubtotal = round(item.unitPrice * item.quantity, decimalDigits);
    if (round(lineSubtotal + item.taxAmount, decimalDigits) !== round(item.lineTotal, decimalDigits)) {
      throw ApiError.badRequest(`Line total does not add up for variant ${item.variantId}`);
    }
    subtotal += lineSubtotal;
    taxTotal += item.taxAmount;
  }
  subtotal = round(subtotal, decimalDigits);
  taxTotal = round(taxTotal, decimalDigits);
  const discountTotal = round(p.discounts.reduce((sum, d) => sum + d.amount, 0), decimalDigits);
  if (subtotal !== round(p.subtotal, decimalDigits) || taxTotal !== round(p.taxTotal, decimalDigits) || discountTotal !== round(p.discountTotal, decimalDigits)) {
    throw ApiError.badRequest('Sale subtotals do not match its lines');
  }
  const total = round(subtotal - discountTotal + taxTotal, decimalDigits);
  if (total !== round(p.total, decimalDigits)) throw ApiError.badRequest('Sale total does not match its lines');
  const paid = round(p.payments.reduce((sum, pay) => sum + pay.amount, 0), decimalDigits);
  if (paid < total) throw ApiError.badRequest(`Payments (${paid}) do not cover the sale total (${total})`);

  const warnings = [];
  const order = await tx.order.create({
    data: {
      id: p.id,
      locationId: p.locationId,
      terminalId: terminal.id,
      cashDrawerSessionId: p.cashDrawerSessionId,
      userId: cashier.id,
      customerId: p.customerId,
      channel: 'POS',
      source: 'OFFLINE_SYNC',
      terminalReceiptNo: p.terminalReceiptNo,
      terminalCreatedAt: p.createdAt,
      status: 'COMPLETED',
      currency: tenantCurrency,
      subtotal,
      discountTotal,
      taxTotal,
      total,
    },
  });

  let itemCount = 0;
  for (const item of p.items) {
    const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, include: { product: true } });
    if (!variant) throw ApiError.badRequest(`Unknown product variant ${item.variantId}`);
    itemCount += item.quantity;

    const orderItem = await tx.orderItem.create({
      data: {
        orderId: order.id,
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      },
    });
    if (item.modifiers.length > 0) {
      await tx.orderItemModifier.createMany({
        data: item.modifiers.map((m) => ({ orderItemId: orderItem.id, modifierId: m.modifierId, priceAdjustment: m.priceAdjustment })),
      });
    }

    if (variant.product.trackInventory) {
      await tx.inventoryItem.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: p.locationId } },
        update: {},
        create: { variantId: variant.id, locationId: p.locationId, quantity: 0 },
      });
      const after = await inventoryService.applyInventoryChange(tx, {
        variantId: variant.id,
        locationId: p.locationId,
        changeQty: -item.quantity,
        reason: 'sale',
        referenceId: order.id,
        allowNegative: true,
      });
      if (Number(after.quantity) < 0) {
        warnings.push(`OVERSOLD: ${variant.sku} is at ${Number(after.quantity)} after this offline sale`);
      }
    }
  }

  for (const d of p.discounts) {
    const { promotionId, amount, reason } = await orderService.resolveDiscountInput(tx, {
      discountInput: d,
      subtotal,
      actingUser: cashier,
      customerId: p.customerId,
      decimalDigits,
    });
    await tx.orderDiscount.create({ data: { orderId: order.id, promotionId, appliedByUserId: cashier.id, amount, reason } });
    await auditLogService.recordAuditLog(tx, {
      userId: cashier.id,
      action: promotionId ? 'order.discount.promotion' : 'order.discount.manual',
      entityType: 'Order',
      entityId: order.id,
      metadata: { amount, reason, promotionCode: d.promotionCode, source: 'OFFLINE_SYNC' },
    });
  }

  for (const pay of p.payments) {

    await orderService.createPaymentWithSideEffects(tx, { payment: pay, orderId: order.id, customerId: p.customerId, tenantCurrency });
  }

  await orderService.earnLoyaltyPoints(tx, { customerId: p.customerId, orderId: order.id, total });

  await salesSummaryService.applySalesForOrder(tx, {
    locationId: p.locationId,
    timezone: location.timezone,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    itemCount,
  });

  await auditLogService.recordAuditLog(tx, {
    userId: cashier.id,
    action: 'order.offline_import',
    entityType: 'Order',
    entityId: order.id,
    metadata: { terminalId: terminal.id, terminalReceiptNo: p.terminalReceiptNo, warnings },
  });

  return { orderId: order.id, orderNumber: order.orderNumber, warnings };
}

async function openDrawer(tx, terminal, payload) {
  const p = parsePayload(DRAWER_OPEN, payload);
  if (p.locationId !== terminal.locationId) throw ApiError.badRequest('Drawer belongs to a different location than this terminal');
  await assertCashier(tx, p.cashierId);
  const session = await tx.cashDrawerSession.create({
    data: {
      id: p.id,
      locationId: p.locationId,
      terminalId: terminal.id,
      openedByUserId: p.cashierId,
      openingFloat: p.openingFloat,
      openedAt: p.openedAt,
    },
  });
  return { sessionId: session.id };
}

async function closeDrawer(tx, terminal, payload) {
  const p = parsePayload(DRAWER_CLOSE, payload);
  const session = await tx.cashDrawerSession.findUnique({ where: { id: p.id } });
  if (!session || session.terminalId !== terminal.id) throw ApiError.badRequest('Cash drawer session not found on this terminal');
  if (session.status !== 'OPEN') throw ApiError.conflict('This cash drawer session is already closed');
  await tx.cashDrawerSession.update({
    where: { id: p.id },
    data: { status: 'CLOSED', closingCash: p.closingCash, closedAt: p.closedAt },
  });
  return { sessionId: p.id };
}

async function createCustomerOp(tx, terminal, payload) {
  const p = parsePayload(CUSTOMER_CREATE, payload);
  if (await tx.customer.findUnique({ where: { id: p.id } })) {
    return { customerId: p.id };
  }
  const customer = await tx.customer.create({ data: { id: p.id, name: p.name, phone: p.phone, email: p.email } });
  return { customerId: customer.id };
}

const HANDLERS = {
  'order.create': (tx, terminal, payload) => importOfflineOrder(tx, terminal, payload),
  'drawer.open': openDrawer,
  'drawer.close': closeDrawer,
  'customer.create': createCustomerOp,
};

function storedOutcome(row) {
  return { opId: row.opId, status: row.status === 'CREATED' ? 'DUPLICATE' : 'REJECTED', result: row.result };
}

async function pushOps(terminal, ops) {
  const outcomes = [];
  for (const op of ops) {
    const handler = HANDLERS[op.type];
    if (!handler) {
      outcomes.push({ opId: op.opId, status: 'REJECTED', result: { error: `Unsupported operation type ${op.type}` } });
      continue;
    }

    const prior = await prisma.syncOp.findFirst({ where: { opId: op.opId } });
    if (prior) {
      outcomes.push(storedOutcome(prior));
      continue;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const applied = await handler(tx, terminal, op.payload);
        await tx.syncOp.create({
          data: { terminalId: terminal.id, opId: op.opId, type: op.type, status: 'CREATED', result: applied },
        });
        return applied;
      });
      outcomes.push({ opId: op.opId, status: 'CREATED', result });
    } catch (err) {
      if (err instanceof DuplicateSale) {
        const result = { orderId: err.orderId };
        await prisma.syncOp.create({ data: { terminalId: terminal.id, opId: op.opId, type: op.type, status: 'CREATED', result } });
        outcomes.push({ opId: op.opId, status: 'DUPLICATE', result });
      } else if (err instanceof ApiError) {
        const result = { error: err.message, details: err.details || undefined };
        const rejected = await prisma.syncOp.create({ data: { terminalId: terminal.id, opId: op.opId, type: op.type, status: 'REJECTED', result } });
        outcomes.push(storedOutcome(rejected));
      } else if (err.code === 'P2002') {
        const winner = await prisma.syncOp.findFirst({ where: { opId: op.opId } });
        outcomes.push(winner ? storedOutcome(winner) : { opId: op.opId, status: 'REJECTED', result: { error: 'Conflicting upload, retry' } });
      } else {
        throw err; 
      }
    }
  }
  return outcomes;
}

export default { pushOps };
