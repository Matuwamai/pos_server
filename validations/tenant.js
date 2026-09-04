import { z } from 'zod';
 
const subdomainRegex = /^[a-z0-9-]{3,63}$/;
const subdomainMessage = 'Lowercase letters, numbers, hyphens only (3-63 chars)';
 
const idParams = z.object({ id: z.string().uuid() });
 
// Admin-driven tenant provisioning — creates the Tenant + a default
// Location, but NOT an owner user. Use the /auth/signup flow instead when
// a business is self-registering (that flow creates tenant + owner +
// location together in one transaction).
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
 
// Only name/plan are editable here. Status changes go through the explicit
// suspend/reactivate/cancel endpoints below so each transition is its own
// auditable, intent-revealing action rather than a generic field update.
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
 
// Fetch-many: search + filter + pagination, all optional.
const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR subdomain
    status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
    plan: z.string().min(1).max(50).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(['name', 'createdAt', 'subdomain']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};
 
export default { create, getById, update, suspend, reactivate, cancel, list };