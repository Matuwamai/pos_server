import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';
import terminalService from './terminal.js';
import customerService from './customer.js';
import cashDrawerSessionService from './cashDrawerSession.js';
import inventoryService from './inventory.js';
import promotionService from './promotion.js';
import taxRateService from './taxRate.js';
import storeCreditTransactionService from './storeCreditTransaction.js';
import giftCardService from './giftCard.js';
import auditLogService from './auditLog.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// Scope note: orders are built client-side (a till app manages its own cart)
// and submitted here as one finished sale — there's no server-side OPEN
// cart to incrementally edit, and no separate "void" endpoint. Cancelling a
// completed sale goes through refundOrder() for every item instead, since
// that already does the one thing void would need to duplicate: restock
// inventory and reverse payments.

const orderInclude = {
  location: { select: { id: true, name: true } },
  terminal: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  items: {
    include: {
      variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } },
      modifiers: { include: { modifier: { select: { id: true, name: true } } } },
    },
  },
  discounts: true,
  payments: true,
  refunds: { include: { items: true } },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function resolveDefaultTaxRate() {
  try {
    return await taxRateService.getDefaultTaxRate();
  } catch {
    return null;
  }
}

// Validates a variant/modifiers selection and prices one line item.
// Modifiers must belong to a ModifierGroup actually attached to the
// product being sold — otherwise any modifier from any product could be
// tacked onto any sale.
async function priceAndValidateItem(tx, { variantId, quantity, modifierIds }, defaultTaxRate) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: true, taxRate: true } });
  if (!variant) throw ApiError.notFound(`Variant ${variantId} not found`);
  if (!variant.isActive) throw ApiError.conflict(`Variant ${variant.sku} is not active`);
  if (!variant.product.isActive) throw ApiError.conflict(`Product for variant ${variant.sku} is not active`);

  let modifiersTotal = 0;
  const modifierRows = [];
  for (const modifierId of modifierIds || []) {
    const modifier = await tx.modifier.findUnique({ where: { id: modifierId } });
    if (!modifier) throw ApiError.notFound(`Modifier ${modifierId} not found`);
    const attached = await tx.productModifierGroup.findUnique({
      where: { productId_modifierGroupId: { productId: variant.productId, modifierGroupId: modifier.modifierGroupId } },
    });
    if (!attached) throw ApiError.badRequest(`Modifier "${modifier.name}" is not available for this product`);
    modifiersTotal += Number(modifier.priceAdjustment);
    modifierRows.push({ modifierId, priceAdjustment: modifier.priceAdjustment });
  }

  const unitPrice = Number(variant.price);
  const lineSubtotal = round2((unitPrice + modifiersTotal) * quantity);
  const effectiveTaxRate = variant.taxRate || defaultTaxRate;
  const taxAmount = effectiveTaxRate ? round2(lineSubtotal * Number(effectiveTaxRate.rate)) : 0;
  const lineTotal = round2(lineSubtotal + taxAmount);

  return { variant, quantity, unitPrice, lineSubtotal, taxAmount, lineTotal, modifierRows };
}

// A composite product (e.g. a Latte) deducts its bill-of-materials
// components instead of its own stock; everything else deducts itself
// directly. Products with trackInventory off are skipped entirely — same
// rule product creation already uses to decide whether to provision
// InventoryItem rows in the first place.
async function deductInventoryForSale(tx, { variant, quantity, locationId, orderId }) {
  if (!variant.product.trackInventory) return;

  if (variant.product.isComposite) {
    const components = await tx.productComponent.findMany({ where: { parentVariantId: variant.id } });
    for (const component of components) {
      await inventoryService.applyInventoryChange(tx, {
        variantId: component.componentVariantId,
        locationId,
        changeQty: -(Number(component.quantity) * quantity),
        reason: 'sale',
        referenceId: orderId,
      });
    }
  } else {
    await inventoryService.applyInventoryChange(tx, {
      variantId: variant.id,
      locationId,
      changeQty: -quantity,
      reason: 'sale',
      referenceId: orderId,
    });
  }
}

async function restockInventoryForRefund(tx, { variant, quantity, locationId, refundId }) {
  if (!variant.product.trackInventory) return;

  if (variant.product.isComposite) {
    const components = await tx.productComponent.findMany({ where: { parentVariantId: variant.id } });
    for (const component of components) {
      await inventoryService.applyInventoryChange(tx, {
        variantId: component.componentVariantId,
        locationId,
        changeQty: Number(component.quantity) * quantity,
        reason: 'return',
        referenceId: refundId,
        allowNegative: true,
      });
    }
  } else {
    await inventoryService.applyInventoryChange(tx, {
      variantId: variant.id,
      locationId,
      changeQty: quantity,
      reason: 'return',
      referenceId: refundId,
      allowNegative: true,
    });
  }
}

function buildOrderSearchFilter(search) {
  if (!search) return {};
  const asNumber = Number(search);
  const numericFilter = Number.isInteger(asNumber) ? [{ orderNumber: asNumber }] : [];
  return { OR: [...numericFilter, { customer: { name: { contains: search } } }] };
}

async function createOrder(actingUser, { locationId, terminalId, cashDrawerSessionId, customerId, channel, items, discounts, payments }) {
  await locationService.getLocationById(locationId); // 404s if missing/foreign tenant

  if (terminalId) {
    const terminal = await terminalService.getTerminalById(terminalId);
    if (terminal.locationId !== locationId) {
      throw ApiError.badRequest('This terminal does not belong to the specified location');
    }
  }
  if (customerId) {
    await customerService.getCustomerById(customerId);
  }
  if (cashDrawerSessionId) {
    const session = await cashDrawerSessionService.getSessionById(cashDrawerSessionId);
    if (session.status !== 'OPEN') throw ApiError.conflict('This cash drawer session is not open');
    if (session.locationId !== locationId) {
      throw ApiError.badRequest('This cash drawer session does not belong to the specified location');
    }
  }

  const defaultTaxRate = await resolveDefaultTaxRate();

  const orderId = await prisma.$transaction(async (tx) => {
    const pricedItems = [];
    for (const itemInput of items) {
      pricedItems.push(await priceAndValidateItem(tx, itemInput, defaultTaxRate));
    }

    const subtotal = round2(pricedItems.reduce((sum, i) => sum + i.lineSubtotal, 0));
    const taxTotal = round2(pricedItems.reduce((sum, i) => sum + i.taxAmount, 0));

    let discountTotal = 0;
    const discountRows = [];
    for (const discountInput of discounts || []) {
      let promotionId = null;
      let amount = discountInput.amount;

      if (discountInput.promotionCode) {
        const promotion = await promotionService.getValidPromotionByCode(discountInput.promotionCode);
        if (promotion.minSubtotal && subtotal < Number(promotion.minSubtotal)) {
          throw ApiError.conflict(`This promotion requires a subtotal of at least ${promotion.minSubtotal}`);
        }
        promotionId = promotion.id;
        if (amount === undefined) {
          if (promotion.type === 'PERCENTAGE') amount = round2(subtotal * (Number(promotion.value) / 100));
          else if (promotion.type === 'FIXED_AMOUNT') amount = Number(promotion.value);
          else throw ApiError.badRequest('A BOGO promotion requires an explicit discount amount');
        }
      } else if (!['OWNER', 'MANAGER'].includes(actingUser.role)) {
        // A promo-code discount is driven by a code anyone can enter; a
        // discount with no code is pure staff discretion, so it's gated.
        throw ApiError.forbidden('Only a manager can apply a manual discount');
      }

      discountTotal += amount;
      discountRows.push({ promotionId, appliedByUserId: actingUser.id, amount, reason: discountInput.reason });
    }
    discountTotal = round2(discountTotal);

    const total = round2(subtotal - discountTotal + taxTotal);
    if (total < 0) {
      throw ApiError.badRequest('Discounts cannot exceed the order subtotal plus tax');
    }

    // Cash can overtender for change; other methods aren't checked against
    // overpayment here to avoid rejecting reasonable rounding.
    const paymentsTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));
    if (paymentsTotal < total) {
      throw ApiError.badRequest(`Payments (${paymentsTotal}) do not cover the order total (${total})`);
    }

    const order = await tx.order.create({
      data: {
        locationId,
        terminalId,
        cashDrawerSessionId,
        userId: actingUser.id,
        customerId,
        channel: channel || 'POS',
        status: 'COMPLETED',
        subtotal,
        discountTotal,
        taxTotal,
        total,
      },
    });

    for (const priced of pricedItems) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          variantId: priced.variant.id,
          quantity: priced.quantity,
          unitPrice: priced.unitPrice,
          taxAmount: priced.taxAmount,
          lineTotal: priced.lineTotal,
        },
      });
      if (priced.modifierRows.length > 0) {
        await tx.orderItemModifier.createMany({
          data: priced.modifierRows.map((m) => ({
            orderItemId: orderItem.id,
            modifierId: m.modifierId,
            priceAdjustment: m.priceAdjustment,
          })),
        });
      }
      await deductInventoryForSale(tx, { variant: priced.variant, quantity: priced.quantity, locationId, orderId: order.id });
    }

    if (discountRows.length > 0) {
      await tx.orderDiscount.createMany({ data: discountRows.map((d) => ({ orderId: order.id, ...d })) });
      for (const d of discountRows) {
        if (!d.promotionId) {
          await auditLogService.recordAuditLog(tx, {
            userId: actingUser.id,
            action: 'order.discount.manual',
            entityType: 'Order',
            entityId: order.id,
            metadata: { amount: d.amount, reason: d.reason },
          });
        }
      }
    }

    for (const payment of payments) {
      await tx.payment.create({
        data: { orderId: order.id, method: payment.method, amount: payment.amount, status: 'CAPTURED', transactionRef: payment.transactionRef },
      });

      if (payment.method === 'STORE_CREDIT') {
        if (!customerId) throw ApiError.badRequest('A customer is required to pay with store credit');
        await storeCreditTransactionService.applyStoreCreditChange(tx, {
          customerId,
          orderId: order.id,
          type: 'REDEEM',
          amount: -payment.amount,
        });
      }

      if (payment.method === 'GIFT_CARD') {
        // Looked up via `tx` (not giftCardService.getCardByCode, which uses
        // the plain client) so the balance check/decrement stays inside
        // this same transaction.
        const giftCard = await tx.giftCard.findFirst({ where: { code: payment.giftCardCode } });
        if (!giftCard) throw ApiError.notFound('Gift card not found');
        giftCardService.assertUsable(giftCard);
        await giftCardService.applyGiftCardChange(tx, { giftCard, type: 'REDEEM', amount: -payment.amount, orderId: order.id });
      }
    }

    // Auto-earn on completion, if there's a customer and an active program.
    // No "pay with points" here — PaymentMethod has no such option; point
    // redemption stays a separate action via /loyalty-transactions/redeem.
    if (customerId) {
      const program = await prisma.loyaltyProgram.findFirst();
      if (program && program.isActive) {
        const points = Math.floor(total * Number(program.pointsPerCurrencyUnit));
        if (points > 0) {
          await tx.loyaltyTransaction.create({ data: { customerId, orderId: order.id, type: 'EARN', points } });
        }
      }
    }

    return order.id;
  });

  return getOrderById(orderId);
}

async function listOrders({ search, status, customerId, locationId, terminalId, page, limit }) {
  const where = {
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(terminalId ? { terminalId } : {}),
    ...buildOrderSearchFilter(search),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, ...getPagination({ page, limit }), include: orderInclude }),
  ]);

  return { data: orders, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getOrderById(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

async function refundOrder(id, actingUser, { items, reason, refundMethod, giftCardCode }) {
  const order = await getOrderById(id);
  if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order.status)) {
    throw ApiError.conflict('This order is not eligible for a refund');
  }
  if (refundMethod === 'STORE_CREDIT' && !order.customerId) {
    throw ApiError.badRequest('A customer is required to refund to store credit');
  }

  await prisma.$transaction(async (tx) => {
    const validated = [];
    let totalAmount = 0;

    for (const { orderItemId, quantity, amount } of items) {
      const orderItem = order.items.find((i) => i.id === orderItemId);
      if (!orderItem) throw ApiError.notFound(`Order item ${orderItemId} not found on this order`);

      const alreadyRefunded = await tx.refundItem.aggregate({ where: { orderItemId }, _sum: { quantity: true } });
      const refundedSoFar = Number(alreadyRefunded._sum.quantity ?? 0);
      const remaining = Number(orderItem.quantity) - refundedSoFar;
      if (quantity > remaining) {
        throw ApiError.badRequest(`Cannot refund ${quantity} of this item: only ${remaining} remain refundable`);
      }

      const variant = await tx.productVariant.findUnique({ where: { id: orderItem.variantId }, include: { product: true } });
      validated.push({ orderItemId, quantity, amount, variant });
      totalAmount += amount;
    }
    totalAmount = round2(totalAmount);

    const refund = await tx.refund.create({ data: { orderId: order.id, processedByUserId: actingUser.id, reason, totalAmount } });

    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'order.refund',
      entityType: 'Refund',
      entityId: refund.id,
      metadata: { orderId: order.id, totalAmount, refundMethod, reason },
    });

    await tx.refundItem.createMany({
      data: validated.map((v) => ({ refundId: refund.id, orderItemId: v.orderItemId, quantity: v.quantity, amount: v.amount })),
    });

    for (const v of validated) {
      await restockInventoryForRefund(tx, { variant: v.variant, quantity: v.quantity, locationId: order.locationId, refundId: refund.id });
    }

    await tx.payment.create({ data: { orderId: order.id, method: refundMethod, amount: -totalAmount, status: 'CAPTURED' } });

    if (refundMethod === 'STORE_CREDIT') {
      await storeCreditTransactionService.applyStoreCreditChange(tx, {
        customerId: order.customerId,
        orderId: order.id,
        type: 'ISSUE',
        amount: totalAmount,
      });
    }
    if (refundMethod === 'GIFT_CARD') {
      const giftCard = await tx.giftCard.findFirst({ where: { code: giftCardCode } });
      if (!giftCard) throw ApiError.notFound('Gift card not found');
      await giftCardService.applyGiftCardChange(tx, { giftCard, type: 'RELOAD', amount: totalAmount, orderId: order.id });
    }

    // Fully refunded once every item's cumulative refunded quantity meets
    // what was actually sold on it.
    const allItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
    let fullyRefunded = true;
    for (const item of allItems) {
      const sum = await tx.refundItem.aggregate({ where: { orderItemId: item.id }, _sum: { quantity: true } });
      if (Number(sum._sum.quantity ?? 0) < Number(item.quantity)) {
        fullyRefunded = false;
        break;
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
  });

  return getOrderById(id);
}

export default { createOrder, listOrders, getOrderById, refundOrder };
