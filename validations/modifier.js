import { z } from 'zod';

const params = z.object({ modifierGroupId: z.string().uuid() });
const idParams = z.object({ modifierGroupId: z.string().uuid(), id: z.string().uuid() });

const create = {
  params,
  body: z.object({
    name: z.string().min(1).max(120),
    priceAdjustment: z.coerce.number().optional(),
  }),
};

const list = {
  params,
};

const getById = {
  params: idParams,
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      priceAdjustment: z.coerce.number().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const deactivate = {
  params: idParams,
};

const reactivate = {
  params: idParams,
};

export default { create, list, getById, update, deactivate, reactivate };
