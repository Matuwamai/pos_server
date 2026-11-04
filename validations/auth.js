import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../config/currencies.js';

const subdomainRegex = /^[a-z0-9-]{3,63}$/;
const subdomainMessage = 'Lowercase letters, numbers, hyphens only (3-63 chars)';
const currencyCodes = SUPPORTED_CURRENCIES.map((c) => c.code);

// Self-registration: creates the Tenant + a default Location + the OWNER
// user in one transaction. This is the ONLY way a tenant gets its first
// user — admin-driven provisioning (POST /api/v1/tenants) deliberately does
// not create one, see tenant.service.js.
const signup = {
  body: z.object({
    tenantName: z.string().min(2).max(120),
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    // Required, no default — set once here and immutable after (no PATCH
    // endpoint for it). Changing a tenant's currency once it has real
    // transaction history is a retroactive-conversion problem, not a
    // settings tweak.
    currency: z.enum(currencyCodes, { message: 'Unsupported currency' }),
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

const verifyOtp = {
  body: z.object({
    mfaToken: z.string().min(1),
    code: z.string().length(6),
  }),
};

const resendOtp = {
  body: z.object({
    mfaToken: z.string().min(1),
  }),
};

// Deliberately the same shape for every input the caller could send — the
// endpoint answers identically whether or not the account exists.
const forgotPassword = {
  body: z.object({
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    email: z.string().email(),
  }),
};

const resetPassword = {
  body: z.object({
    subdomain: z.string().regex(subdomainRegex, subdomainMessage),
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
};

export default { signup, login, verifyOtp, resendOtp, forgotPassword, resetPassword };
