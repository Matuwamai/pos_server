import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import inventoryService from './inventory.js';
import salesSummaryService from './salesSummary.js';
import auditLogService from './auditLog.js';

// The till prices and taxes a sale itself, offline. The server does not
// reprice it: it checks the arithmetic is internally consistent, records the
// terminal's snapshot, and flags anything that oversold stock.

const round2 = (n) => Math.round(n * 100) / 100;
const uuid = z.string().uuid();
const money = z.coerce.number().nonnegative();

const ORDER_PAYLOAD = z.object({
  id: uuid, // the client-generated Order id — the idempotency anchor for the sale
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
  discounts: z.array(z.object({ amount: z.coerce.number().positive(), reason: z.string().max(255).optional() })).default([]),
  payments: z
    .array(
      z
        .object({ method: z.enum(['CASH', 'CARD', 'MPESA', 'OTHER']), amount: z.coerce.number().positive(), transactionRef: z.string().max(255).optional() })
        .refine((p) => p.method !== 'MPESA' || !!p.transactionRef, {
          message: 'transactionRef (the M-Pesa confirmation code) is required for MPESA payments',
          path: ['transactionRef'],
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

// Customer creation is the one non-sale write a till needs while offline-first:
// the device token can only reach `sync.pull`/`sync.push` (middlewares/authenticateTerminal.js),
// not `POST /customers`, so this goes through the same op pipeline as a sale rather than
// widening what a bare device credential can do.
const CUSTOMER_CREATE = z.object({
  id: uuid, // client-generated — the cashier needs the real id back immediately to attach it to the sale in progress
  name: z.string().min(1).max(255),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
});

// Thrown when an opId's sale already exists under another opId, so the
// caller can return the original result rather than a rejection.
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

  // Arithmetic must be internally consistent: every line, the totals, and
  // the payments. Anything else is a corrupted or tampered sale.
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of p.items) {
    const lineSubtotal = round2(item.unitPrice * item.quantity);
    if (round2(lineSubtotal + item.taxAmount) !== round2(item.lineTotal)) {
      throw ApiError.badRequest(`Line total does not add up for variant ${item.variantId}`);
    }
    subtotal += lineSubtotal;
    taxTotal += item.taxAmount;
  }
  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  const discountTotal = round2(p.discounts.reduce((sum, d) => sum + d.amount, 0));
  if (subtotal !== round2(p.subtotal) || taxTotal !== round2(p.taxTotal) || discountTotal !== round2(p.discountTotal)) {
    throw ApiError.badRequest('Sale subtotals do not match its lines');
  }
  const total = round2(subtotal - discountTotal + taxTotal);
  if (total !== round2(p.total)) throw ApiError.badRequest('Sale total does not match its lines');
  const paid = round2(p.payments.reduce((sum, pay) => sum + pay.amount, 0));
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
      // A till can sell a product that was never stocked at this location;
      // the row is created at zero rather than rejecting the sale.
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
    await tx.orderDiscount.create({ data: { orderId: order.id, appliedByUserId: cashier.id, amount: d.amount, reason: d.reason } });
    await auditLogService.recordAuditLog(tx, {
      userId: cashier.id,
      action: 'order.discount.manual',
      entityType: 'Order',
      entityId: order.id,
      metadata: { amount: d.amount, reason: d.reason, source: 'OFFLINE_SYNC' },
    });
  }

  for (const pay of p.payments) {
    await tx.payment.create({
      data: { orderId: order.id, method: pay.method, amount: pay.amount, status: 'CAPTURED', transactionRef: pay.transactionRef },
    });
  }

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
    // Same shape as DuplicateSale below, but a plain return is enough here — there's
    // no separate "which op created it" lookup needed, the id itself is the answer.
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

// Each op is applied in its own transaction together with its SyncOp record,
// so a crash can never leave a sale applied without its replay record. Ops
// are independent: one rejected op does not stop the rest of the batch.
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
        // Two copies of the same op raced; the loser sees the winner's record.
        const winner = await prisma.syncOp.findFirst({ where: { opId: op.opId } });
        outcomes.push(winner ? storedOutcome(winner) : { opId: op.opId, status: 'REJECTED', result: { error: 'Conflicting upload, retry' } });
      } else {
        throw err; // unexpected: let the whole push fail so the till retries later
      }
    }
  }
  return outcomes;
}

export default { pushOps };
