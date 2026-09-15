import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const eventTypeEnum = z.enum([
  'ORDER_CREATED',
  'ORDER_DISPATCHED',
  'PAYMENT_RECEIVED',
  'ACCOUNT_RECONCILIATION',
  'MARKETING',
  'OTP',
  'DIRECT_MESSAGE',
  'ACCOUNT_CREATION',
  'OTP_RESEND',
]);

const codeRegex = /^[a-z0-9_-]{2,60}$/;
const codeMessage = 'Lowercase letters, numbers, hyphens, underscores only (2-60 chars)';

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    code: z.string().regex(codeRegex, codeMessage),
    content: z.string().min(1).max(1000),
    eventType: eventTypeEnum,
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR code
    eventType: eventTypeEnum.optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      code: z.string().regex(codeRegex, codeMessage).optional(),
      content: z.string().min(1).max(1000).optional(),
      eventType: eventTypeEnum.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const deactivate = {
  params: idParams,
};

const reactivate = {
  params: idParams,
};

export default { create, getById, list, update, deactivate, reactivate };
