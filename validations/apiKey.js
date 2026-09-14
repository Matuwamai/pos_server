import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    permissionCodes: z.array(z.string()).optional(),
    expiresAt: z.coerce.date().optional(),
  }),
};

const revoke = {
  params: idParams,
};

export default { create, revoke };
