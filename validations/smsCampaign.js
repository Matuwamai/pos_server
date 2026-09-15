import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const statusEnum = z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED']);
const filtersSchema = z.record(z.string(), z.any());

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    templateId: z.string().uuid(),
    recipientMode: z.enum(['FILTER', 'SELECTED']).default('FILTER'),
    filters: filtersSchema.default({}),
    selectedRecipients: z.array(z.string()).optional(),
    scheduledFor: z.coerce.date().optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    status: statusEnum.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// Only meaningful while the campaign is still a DRAFT — enforced in the
// service, since "editable while DRAFT" depends on current DB state, not
// something a schema alone can express.
const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      templateId: z.string().uuid().optional(),
      recipientMode: z.enum(['FILTER', 'SELECTED']).optional(),
      filters: filtersSchema.optional(),
      selectedRecipients: z.array(z.string()).optional(),
      scheduledFor: z.coerce.date().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const cancel = {
  params: idParams,
};

export default { create, getById, list, update, cancel };
