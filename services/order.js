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
import salesSummaryService from './salesSummary.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';
import { getTenantId } from '../config/tenantContext.js';
import { getCurrencyDecimalDigits } from '../config/currencies.js';
import { getEffectiveCashRoundingUnit } from '../config/cashRounding.js';
import { round, roundToNearest } from '../utils/money.js';

const orderInclude = {
  location: { select: { id: true, name: true, timezone: true } },
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

async function getCurrentTenantSettings(tx) {
  const tenant = await tx.tenant.findUnique({ where: { id: getTenantId() }, select: { currency: true, cashRoundingUnit: true } });
  return { currency: tenant.currency, cashRoundingUnit: tenant.cashRoundingUnit === null ? null : Number(tenant.cashRoundingUnit) };
}

async function resolveDefaultTaxRate() {
  try {
    return await taxRateService.getDefaultTaxRate();
  } catch {
    return null;
  }
}

async function priceAndValidateItem(tx, { variantId, quantity, modifierIds }, defaultTaxRate, decimalDigits) {
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
  const lineSubtotal = round((unitPrice + modifiersTotal) * quantity, decimalDigits);
  const effectiveTaxRate = variant.taxRate || defaultTaxRate;
  const taxAmount = effectiveTaxRate ? round(lineSubtotal * Number(effectiveTaxRate.rate), decimalDigits) : 0;
  const lineTotal = round(lineSubtotal + taxAmount, decimalDigits);

  return { variant, quantity, unitPrice, lineSubtotal, taxAmount, lineTotal, modifierRows };
}

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

async function resolveDiscountInput(tx, { discountInput, subtotal, actingUser, customerId, decimalDigits }) {
  let promotionId = null;
  let amount = discountInput.amount;

  if (discountInput.promotionCode) {
    const promotion = await promotionService.getValidPromotionByCode(discountInput.promotionCode);
    if (promotion.minSubtotal && subtotal < Number(promotion.minSubtotal)) {
      throw ApiError.conflict(`This promotion requires a subtotal of at least ${promotion.minSubtotal}`);
    }
    promotionId = promotion.id;
    if (amount === undefined) {
      if (promotion.type === 'PERCENTAGE') amount = round(subtotal * (Number(promotion.value) / 100), decimalDigits);
      else if (promotion.type === 'FIXED_AMOUNT') amount = Number(promotion.value);
      else throw ApiError.badRequest('A BOGO promotion requires an explicit discount amount');
    }
  } else if (discountInput.loyaltyPointsRedeemed) {
    if (!customerId) throw ApiError.badRequest('A customer is required to redeem loyalty points');
    const program = await tx.loyaltyProgram.findFirst();
    if (!program || !program.isActive) {
      throw ApiError.conflict('The loyalty program is not currently active');
    }
    const points = discountInput.loyaltyPointsRedeemed;
    const result = await tx.loyaltyTransaction.aggregate({ where: { customerId }, _sum: { points: true } });
    const balance = result._sum.points ?? 0;
    if (points > balance) {
      throw ApiError.conflict(`Insufficient points: only ${balance} available`);
    }
    amount = round(points * Number(program.redemptionRate), decimalDigits);
    return { promotionId: null, amount, reason: `Redeemed ${points} loyalty points`, loyaltyPointsRedeemed: points };
  } else if (!['OWNER', 'MANAGER'].includes(actingUser.role)) {
    throw ApiError.forbidden('Only a manager can apply a manual discount');
  }

  return { promotionId, amount, reason: discountInput.reason };
}

async function createPaymentWithSideEffects(tx, { payment, orderId, customerId, tenantCurrency }) {
  if (payment.method === 'MPESA' && tenantCurrency !== 'KES') {
    throw ApiError.badRequest('M-Pesa is only available for businesses whose currency is KES');
  }

  // Unlike MPESA above, this actually verifies the submitted transactionRef against a
  // real webhook-confirmed intent rather than trusting the client outright — Stripe
  // gives us a signature-verified COMPLETED row to check, so there's no reason not to.
  if (payment.method === 'STRIPE') {
    const intent = await tx.stripePaymentIntent.findFirst({
      where: { id: payment.transactionRef, tenantId: getTenantId() },
    });
    if (!intent) throw ApiError.badRequest('Stripe payment intent not found');
    if (intent.status !== 'COMPLETED') throw ApiError.badRequest('This Stripe payment has not completed yet');
    if (intent.consumedByOrderId) throw ApiError.conflict('This Stripe payment has already been applied to an order');
    if (Number(intent.amount) !== Number(payment.amount)) {
      throw ApiError.badRequest('The Stripe payment amount does not match the amount being tendered');
    }
    await tx.stripePaymentIntent.update({ where: { id: intent.id }, data: { consumedByOrderId: orderId } });
  }

  await tx.payment.create({
    data: { orderId, method: payment.method, amount: payment.amount, status: 'CAPTURED', transactionRef: payment.transactionRef },
  });

  if (payment.method === 'STORE_CREDIT') {
    if (!customerId) throw ApiError.badRequest('A customer is required to pay with store credit');
    await storeCreditTransactionService.applyStoreCreditChange(tx, { customerId, orderId, type: 'REDEEM', amount: -payment.amount });
  }

  if (payment.method === 'GIFT_CARD') {
    const giftCard = await tx.giftCard.findFirst({ where: { code: payment.giftCardCode } });
    if (!giftCard) throw ApiError.notFound('Gift card not found');
    giftCardService.assertUsable(giftCard);
    await giftCardService.applyGiftCardChange(tx, { giftCard, type: 'REDEEM', amount: -payment.amount, orderId });
  }
}

async function earnLoyaltyPoints(tx, { customerId, orderId, total }) {
  if (!customerId) return;
  const program = await tx.loyaltyProgram.findFirst();
  if (program && program.isActive) {
    const points = Math.floor(total * Number(program.pointsPerCurrencyUnit));
    if (points > 0) {
      await tx.loyaltyTransaction.create({ data: { customerId, orderId, type: 'EARN', points } });
    }
  }
}

function buildOrderSearchFilter(search) {
  if (!search) return {};
  const asNumber = Number(search);
  const numericFilter = Number.isInteger(asNumber) ? [{ orderNumber: asNumber }] : [];
  return { OR: [...numericFilter, { customer: { name: { contains: search } } }] };
}

async function createOrder(actingUser, { locationId, terminalId, cashDrawerSessionId, customerId, channel, items, discounts, payments }) {
  const location = await locationService.getLocationById(locationId); // 404s if missing/foreign tenant

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
    const { currency: tenantCurrency, cashRoundingUnit } = await getCurrentTenantSettings(tx);
    const decimalDigits = getCurrencyDecimalDigits(tenantCurrency);

    const pricedItems = [];
    for (const itemInput of items) {
      pricedItems.push(await priceAndValidateItem(tx, itemInput, defaultTaxRate, decimalDigits));
    }

    const subtotal = round(pricedItems.reduce((sum, i) => sum + i.lineSubtotal, 0), decimalDigits);
    const taxTotal = round(pricedItems.reduce((sum, i) => sum + i.taxAmount, 0), decimalDigits);

    let discountTotal = 0;
    const discountRows = [];
    for (const discountInput of discounts || []) {
      const { promotionId, amount, reason, loyaltyPointsRedeemed } = await resolveDiscountInput(tx, {
        discountInput,
        subtotal,
        actingUser,
        customerId,
        decimalDigits,
      });
      discountTotal += amount;
      discountRows.push({ promotionId, appliedByUserId: actingUser.id, amount, reason, loyaltyPointsRedeemed });
    }
    discountTotal = round(discountTotal, decimalDigits);

    const exactTotal = round(subtotal - discountTotal + taxTotal, decimalDigits);
    if (exactTotal < 0) {
      throw ApiError.badRequest('Discounts cannot exceed the order subtotal plus tax');
    }

    // Cash rounding ("Swedish rounding") only ever applies to a single cash tender
    // covering the whole order — never to the subtotal/tax breakdown, and never to a
    // split payment, where attributing the adjustment to just the cash portion is
    // ambiguous. See config/cashRounding.js.
    const isSingleCashPayment = payments.length === 1 && payments[0].method === 'CASH';
    const effectiveCashRoundingUnit = isSingleCashPayment ? getEffectiveCashRoundingUnit(tenantCurrency, cashRoundingUnit) : 0;
    const total = roundToNearest(exactTotal, effectiveCashRoundingUnit);
    const cashRoundingAdjustment = round(total - exactTotal, decimalDigits);

    const paymentsTotal = round(payments.reduce((sum, p) => sum + p.amount, 0), decimalDigits);
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
        currency: tenantCurrency,
        subtotal,
        discountTotal,
        taxTotal,
        cashRoundingAdjustment,
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
      await tx.orderDiscount.createMany({
        data: discountRows.map(({ loyaltyPointsRedeemed, ...d }) => ({ orderId: order.id, ...d })),
      });
      for (const d of discountRows) {
        if (d.loyaltyPointsRedeemed) {
          await tx.loyaltyTransaction.create({
            data: { customerId, orderId: order.id, type: 'REDEEM', points: -d.loyaltyPointsRedeemed },
          });
        } else if (!d.promotionId) {
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
      await createPaymentWithSideEffects(tx, { payment, orderId: order.id, customerId, tenantCurrency });
    }

    await earnLoyaltyPoints(tx, { customerId, orderId: order.id, total });

    const itemCount = pricedItems.reduce((sum, priced) => sum + priced.quantity, 0);
    await salesSummaryService.applySalesForOrder(tx, {
      locationId,
      timezone: location.timezone,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      itemCount,
    });

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
  if (!actingUser?.id) throw ApiError.badRequest('A valid acting user is required to process a refund');
  const processor = await prisma.user.findUnique({ where: { id: actingUser.id } });
  if (!processor || !processor.isActive) throw ApiError.badRequest('processedByUserId is not an active user of this business');

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
    totalAmount = round(totalAmount, getCurrencyDecimalDigits(order.currency));

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

    await salesSummaryService.applyRefundForOrder(tx, {
      locationId: order.locationId,
      timezone: order.location.timezone,
      refundAmount: totalAmount,
    });

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

export default {
  createOrder,
  listOrders,
  getOrderById,
  refundOrder,
  resolveDiscountInput,
  createPaymentWithSideEffects,
  earnLoyaltyPoints,
};
