import { z } from 'zod';
 
const subdomainRegex = /^[a-z0-9-]{3,63}$/;
const subdomainMessage = 'Lowercase letters, numbers, hyphens only (3-63 chars)';
 
const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    plan: z.string().min(1).max(50).optional(),
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
      plan: z.string().min(1).max(50).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field (name or plan) must be provided',
    }),
};
 
const suspend = {
  params: idParams,
  body: z.object({
    reason: z.string().min(1).max(500).optional(),
  }),
};
 
const reactivate = {
  params: idParams,
};
 
const cancel = {
  params: idParams,
  body: z.object({
    reason: z.string().min(1).max(500).optional(),
  }),
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), 
    status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
    plan: z.string().min(1).max(50).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(['name', 'createdAt', 'subdomain']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};
 
export default { create, getById, update, suspend, reactivate, cancel, list };