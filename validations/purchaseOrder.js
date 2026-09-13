import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const itemInput = z.object({
  variantId: z.string().uuid(),
  quantityOrdered: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

const create = {
  body: z.object({
    supplierId: z.string().uuid(),
    locationId: z.string().uuid(),
    expectedAt: z.coerce.date().optional(),
    items: z.array(itemInput).min(1, 'At least one item is required'),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    supplierId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// Only allowed while still DRAFT — replaces the whole items array rather
// than diffing it, since a draft PO is edited as a whole document.
const update = {
  params: idParams,
  body: z.object({
    supplierId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    expectedAt: z.coerce.date().optional(),
    items: z.array(itemInput).min(1).optional(),
  }),
};

const markOrdered = {
  params: idParams,
};

const receive = {
  params: idParams,
  body: z.object({
    items: z
      .array(
        z.object({
          purchaseOrderItemId: z.string().uuid(),
          quantityReceived: z.coerce.number().positive(),
        })
      )
      .min(1, 'At least one item is required'),
  }),
};

const cancel = {
  params: idParams,
};

export default { create, getById, list, update, markOrdered, receive, cancel };
