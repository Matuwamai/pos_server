import { z } from 'zod';

const create = {
  body: z.object({
    pointsPerCurrencyUnit: z.coerce.number().positive().optional(),
    redemptionRate: z.coerce.number().positive().optional(),
  }),
};

const update = {
  body: z
    .object({
      pointsPerCurrencyUnit: z.coerce.number().positive().optional(),
      redemptionRate: z.coerce.number().positive().optional(),
      isActive: z.coerce.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

export default { create, update };
