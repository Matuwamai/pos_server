import { z } from 'zod';
 
const login = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};
 
// Used when an existing super admin creates another one — no public
// self-registration endpoint for platform-level access.
const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
};
 
export default { login, create };
 