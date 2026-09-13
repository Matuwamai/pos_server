import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const paymentMethodEnum = z.enum(['CASH', 'CARD', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER']);

const itemInput = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  modifierIds: z.array(z.string().uuid()).optional(),
});

// Either an existing promo code (amount auto-computed from it, unless
// explicitly overridden) or a manual amount+reason with no code at all.
const discountInput = z
  .object({
    promotionCode: z.string().optional(),
    amount: z.coerce.number().positive().optional(),
    reason: z.string().max(255).optional(),
  })
  .refine((d) => d.promotionCode || d.amount !== undefined, {
    message: 'Either promotionCode or amount must be provided',
  });

const paymentInput = z
  .object({
    method: paymentMethodEnum,
    amount: z.coerce.number().positive(),
    transactionRef: z.string().max(255).optional(),
    giftCardCode: z.string().optional(),
  })
  .refine((d) => d.method !== 'GIFT_CARD' || !!d.giftCardCode, {
    message: 'giftCardCode is required for GIFT_CARD payments',
    path: ['giftCardCode'],
  });

const create = {
  body: z.object({
    locationId: z.string().uuid(),
    terminalId: z.string().uuid().optional(),
    cashDrawerSessionId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    channel: z.enum(['POS', 'ONLINE']).optional(),
    items: z.array(itemInput).min(1, 'At least one item is required'),
    discounts: z.array(discountInput).optional(),
    payments: z.array(paymentInput).min(1, 'At least one payment is required'),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(60).optional(), // matches order number (exact) OR customer name
    status: z.enum(['OPEN', 'PARKED', 'COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
    customerId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    terminalId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const refundItemInput = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  amount: z.coerce.number().nonnegative(),
});

const refund = {
  params: idParams,
  body: z
    .object({
      items: z.array(refundItemInput).min(1, 'At least one item is required'),
      reason: z.string().max(255).optional(),
      refundMethod: paymentMethodEnum,
      giftCardCode: z.string().optional(),
    })
    .refine((d) => d.refundMethod !== 'GIFT_CARD' || !!d.giftCardCode, {
      message: 'giftCardCode is required when refunding to a gift card',
      path: ['giftCardCode'],
    }),
};

export default { create, getById, list, refund };
