import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const clockIn = {
  body: z.object({
    locationId: z.string().uuid(),
  }),
};

const clockOut = {
  params: idParams,
  body: z.object({
    breakMinutes: z.coerce.number().int().min(0).optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    userId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    activeOnly: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export default { clockIn, clockOut, getById, list };
