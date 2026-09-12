import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    customerGroupId: z.string().uuid().optional(),
    name: z.string().min(2).max(120),
    email: z.string().email().optional(),
    phone: z.string().min(1).max(32).optional(),
    marketingOptIn: z.coerce.boolean().optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name, email, OR phone
    customerGroupId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// storeCreditBalance is deliberately not editable here — it's only ever
// changed through StoreCreditTransaction, so there's always an auditable
// reason for every change to it.
const update = {
  params: idParams,
  body: z
    .object({
      customerGroupId: z.string().uuid().nullable().optional(),
      name: z.string().min(2).max(120).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(1).max(32).optional(),
      marketingOptIn: z.coerce.boolean().optional(),
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
