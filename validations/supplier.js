import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().min(1).max(32).optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name, contactEmail, OR contactPhone
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().min(1).max(32).optional(),
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
