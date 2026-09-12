import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    address: z.string().max(255).optional(),
    timezone: z.string().min(1).max(64).optional(),
  }),
};

const getById = {
  params: idParams,
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      address: z.string().max(255).optional(),
      timezone: z.string().min(1).max(64).optional(),
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

export default { create, getById, update, deactivate, reactivate };
