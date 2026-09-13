import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const codeSchema = z.string().regex(/^[A-Z0-9-]{4,32}$/, 'Code must be 4-32 uppercase letters, numbers, or hyphens');

const issue = {
  body: z.object({
    code: codeSchema.optional(), // auto-generated if omitted
    initialBalance: z.coerce.number().positive(),
    issuedToCustomerId: z.string().uuid().optional(),
    expiresAt: z.coerce.date().optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(64).optional(), // matches against code
    isActive: z.coerce.boolean().optional(),
    issuedToCustomerId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const redeem = {
  body: z.object({
    code: codeSchema,
    orderId: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
  }),
};

const reload = {
  body: z.object({
    code: codeSchema,
    amount: z.coerce.number().positive(),
  }),
};

const adjust = {
  params: idParams,
  body: z.object({
    amount: z.coerce.number().refine((v) => v !== 0, 'amount cannot be zero'),
  }),
};

const deactivate = {
  params: idParams,
};

const reactivate = {
  params: idParams,
};

const listTransactions = {
  params: idParams,
};

export default { issue, getById, list, redeem, reload, adjust, deactivate, reactivate, listTransactions };
