import { z } from 'zod';

const earn = {
  body: z.object({
    customerId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    points: z.coerce.number().int().positive(),
  }),
};

const redeem = {
  body: z.object({
    customerId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    points: z.coerce.number().int().positive(),
  }),
};

const adjust = {
  body: z.object({
    customerId: z.string().uuid(),
    points: z.coerce.number().int().refine((v) => v !== 0, 'points cannot be zero'),
  }),
};

const list = {
  query: z.object({
    customerId: z.string().uuid().optional(),
    type: z.enum(['EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRE']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const balanceParams = {
  params: z.object({ customerId: z.string().uuid() }),
};

export default { earn, redeem, adjust, list, balanceParams };
