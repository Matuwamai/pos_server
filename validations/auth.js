import { z } from 'zod';

const subdomainRegex = /^[a-z0-9-]{3,63}$/;
const subdomainMessage = 'Lowercase letters, numbers, hyphens only (3-63 chars)';

// Self-registration: creates the Tenant + a default Location + the OWNER
// user in one transaction. This is the ONLY way a tenant gets its first
// user — admin-driven provisioning (POST /api/v1/tenants) deliberately does
// not create one, see tenant.service.js.
const signup = {
  body: z.object({
    tenantName: z.string().min(2).max(120),
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    ownerName: z.string().min(2).max(120),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
};

const login = {
  body: z.object({
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

export default { signup, login };
