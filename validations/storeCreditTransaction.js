import { z } from 'zod';

const issue = {
  body: z.object({
    customerId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
  }),
};

const redeem = {
  body: z.object({
    customerId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
  }),
};

const adjust = {
  body: z.object({
    customerId: z.string().uuid(),
    amount: z.coerce.number().refine((v) => v !== 0, 'amount cannot be zero'),
  }),
};

const list = {
  query: z.object({
    customerId: z.string().uuid().optional(),
    type: z.enum(['ISSUE', 'REDEEM', 'ADJUSTMENT']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export default { issue, redeem, adjust, list };
