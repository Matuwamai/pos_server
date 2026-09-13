import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const itemInput = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

const create = {
  body: z
    .object({
      fromLocationId: z.string().uuid(),
      toLocationId: z.string().uuid(),
      items: z.array(itemInput).min(1, 'At least one item is required'),
    })
    .refine((data) => data.fromLocationId !== data.toLocationId, {
      message: 'fromLocationId and toLocationId must be different',
      path: ['toLocationId'],
    }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    fromLocationId: z.string().uuid().optional(),
    toLocationId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const markInTransit = {
  params: idParams,
};

const complete = {
  params: idParams,
};

const cancel = {
  params: idParams,
};

export default { create, getById, list, markInTransit, complete, cancel };
