import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const open = {
  body: z.object({
    locationId: z.string().uuid(),
    terminalId: z.string().uuid().optional(),
    openingFloat: z.coerce.number().nonnegative(),
  }),
};

const close = {
  params: idParams,
  body: z.object({
    closingCash: z.coerce.number().nonnegative(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    locationId: z.string().uuid().optional(),
    terminalId: z.string().uuid().optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export default { open, close, getById, list };
