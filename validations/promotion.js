import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const codeSchema = z.string().regex(/^[A-Z0-9-]{2,32}$/, 'Code must be 2-32 uppercase letters, numbers, or hyphens');
const typeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BOGO']);

const create = {
  body: z
    .object({
      name: z.string().min(1).max(120),
      code: codeSchema.optional(), // omitted = automatic promotion, not coupon-triggered
      type: typeEnum,
      value: z.coerce.number().nonnegative(),
      minSubtotal: z.coerce.number().nonnegative().optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
    })
    .refine((data) => data.type !== 'PERCENTAGE' || data.value <= 100, {
      message: "A percentage promotion's value cannot exceed 100",
      path: ['value'],
    })
    .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR code
    isActive: z.coerce.boolean().optional(),
    type: typeEnum.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// The percentage<=100 cross-field check only runs at creation, when the
// full object is known — a partial update can't validate `value` against
// `type` unless both happen to be present in the same request.
const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      code: codeSchema.nullable().optional(),
      type: typeEnum.optional(),
      value: z.coerce.number().nonnegative().optional(),
      minSubtotal: z.coerce.number().nonnegative().nullable().optional(),
      startsAt: z.coerce.date().nullable().optional(),
      endsAt: z.coerce.date().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })
    .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    }),
};

const deactivate = {
  params: idParams,
};

const reactivate = {
  params: idParams,
};

const byCodeParams = {
  params: z.object({ code: codeSchema }),
};

export default { create, getById, list, update, deactivate, reactivate, byCodeParams };
