import { z } from 'zod';

const create = {
  body: z.object({
    amount: z.coerce.number().positive(),
  }),
};

const getById = {
  params: z.object({ id: z.string().uuid() }),
};

export default { create, getById };
