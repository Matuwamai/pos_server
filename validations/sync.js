import { z } from 'zod';

const pull = {
  query: z.object({
    since: z.coerce.number().int().nonnegative().default(0), // epoch ms; 0 = full download
    // Required for the web app's admin tooling. A till's location comes from
    // its device token, so the parameter is ignored for those callers.
    locationId: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(1000).default(500),
  }),
};

const OP_TYPES = ['order.create', 'drawer.open', 'drawer.close', 'customer.create'];

const push = {
  body: z.object({
    ops: z
      .array(
        z.object({
          opId: z.string().min(8).max(64),
          type: z.enum(OP_TYPES),
          clientTime: z.coerce.date().optional(),
          payload: z.record(z.string(), z.any()),
        })
      )
      .min(1)
      .max(100),
  }),
};

export default { pull, push };
