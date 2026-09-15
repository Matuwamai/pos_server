import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const statusEnum = z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID']);
const paymentMethodEnum = z.enum(['CASH', 'CARD', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER']);

const itemInput = z.object({
  variantId: z.string().uuid().optional(),
  description: z.string().min(1).max(255),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative().default(0),
});

const create = {
  body: z.object({
    customerId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    dueDate: z.coerce.date(),
    discountTotal: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(1000).optional(),
    items: z.array(itemInput).min(1, 'At least one item is required'),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    customerId: z.string().uuid().optional(),
    status: statusEnum.optional(),
    overdue: z.coerce.boolean().optional(), // dueDate has passed and it's still SENT/PARTIALLY_PAID
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// Only meaningful while the invoice is still a DRAFT — enforced in the
// service, since that depends on current DB state, not something a schema
// alone can express.
const update = {
  params: idParams,
  body: z
    .object({
      customerId: z.string().uuid().optional(),
      locationId: z.string().uuid().nullable().optional(),
      dueDate: z.coerce.date().optional(),
      discountTotal: z.coerce.number().nonnegative().optional(),
      notes: z.string().max(1000).nullable().optional(),
      items: z.array(itemInput).min(1, 'At least one item is required').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const issue = {
  params: idParams,
};

const recordPayment = {
  params: idParams,
  body: z.object({
    method: paymentMethodEnum,
    amount: z.coerce.number().positive(),
    reference: z.string().max(255).optional(),
  }),
};

const voidInvoice = {
  params: idParams,
  body: z.object({
    reason: z.string().max(255).optional(),
  }),
};

export default { create, getById, list, update, issue, recordPayment, void: voidInvoice };
