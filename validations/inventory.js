import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against variant sku OR product name
    locationId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    lowStockOnly: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const getById = {
  params: idParams,
};

// quantity is deliberately not editable here — it only ever changes through
// an adjustment (or a purchase order / stock transfer), so there's always
// an InventoryLog entry explaining why.
const update = {
  params: idParams,
  body: z.object({
    lowStockThreshold: z.coerce.number().nonnegative().nullable(),
  }),
};

const adjust = {
  body: z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    changeQty: z.coerce.number().refine((v) => v !== 0, 'changeQty cannot be zero'),
    reason: z.string().min(1).max(120).default('adjustment'),
  }),
};

const listLogs = {
  query: z.object({
    variantId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    reason: z.string().min(1).max(120).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export default { list, getById, update, adjust, listLogs };
