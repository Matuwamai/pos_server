import { z } from 'zod';

const rangeQuery = {
  locationId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

const list = {
  query: z.object({
    ...rangeQuery,
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const totals = {
  query: z.object(rangeQuery),
};

export default { list, totals };
