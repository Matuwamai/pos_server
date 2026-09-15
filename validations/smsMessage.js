import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const statusEnum = z.enum(['PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED', 'PERMANENTLY_FAILED']);
const phoneSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Use E.164 format, e.g. +254712345678');

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    recipientPhone: z.string().min(1).max(20).optional(),
    status: statusEnum.optional(),
    campaignId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const send = {
  body: z.object({
    recipientPhone: phoneSchema,
    recipientName: z.string().min(1).max(120).optional(),
    recipientType: z.enum(['CUSTOMER', 'STAFF', 'SUPPLIER']).default('CUSTOMER'),
    message: z.string().min(1).max(1000),
  }),
};

export default { getById, list, send };
