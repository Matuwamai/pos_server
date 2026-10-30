import { z } from 'zod';

const create = {
  body: z.object({
    amount: z.coerce.number().positive(),
    phoneNumber: z.string().regex(/^254[17]\d{8}$/, 'Use the format 2547XXXXXXXX or 2541XXXXXXXX'),
  }),
};

const getById = {
  params: z.object({ id: z.string().uuid() }),
};

export default { create, getById };
