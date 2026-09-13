import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    name: z.string().min(1).max(120),
    rate: z.coerce.number().min(0).max(1), // e.g. 0.16 = 16%
    region: z.string().min(1).max(120).optional(),
    isDefault: z.coerce.boolean().optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR region
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      rate: z.coerce.number().min(0).max(1).optional(),
      region: z.string().min(1).max(120).nullable().optional(),
      isDefault: z.coerce.boolean().optional(),
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

export default { create, getById, list, update, deactivate, reactivate };
