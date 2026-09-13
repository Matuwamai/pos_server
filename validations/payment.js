import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const methodEnum = z.enum(['CASH', 'CARD', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER']);
const statusEnum = z.enum(['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED']);

const list = {
  query: z.object({
    orderId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    method: methodEnum.optional(),
    status: statusEnum.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const getById = {
  params: idParams,
};

const updateStatus = {
  params: idParams,
  body: z.object({
    status: statusEnum,
    note: z.string().max(255).optional(),
  }),
};

export default { list, getById, updateStatus };
