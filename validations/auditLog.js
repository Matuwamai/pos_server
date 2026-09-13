import { z } from 'zod';

const list = {
  query: z.object({
    entityType: z.string().min(1).max(60).optional(),
    entityId: z.string().min(1).max(64).optional(),
    userId: z.string().uuid().optional(),
    action: z.string().min(1).max(120).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export default { list };
