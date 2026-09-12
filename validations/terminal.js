import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const platformEnum = z.enum(['web', 'desktop', 'mobile']);

const create = {
  body: z.object({
    locationId: z.string().uuid(),
    name: z.string().min(2).max(120),
    deviceIdentifier: z.string().min(1).max(255),
    platform: platformEnum.optional(),
  }),
};

const list = {
  query: z.object({
    locationId: z.string().uuid().optional(),
  }),
};

const getById = {
  params: idParams,
};

const update = {
  params: idParams,
  body: z
    .object({
      name: z.string().min(2).max(120).optional(),
      platform: platformEnum.optional(),
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

const heartbeat = {
  params: idParams,
};

export default { create, list, getById, update, deactivate, reactivate, heartbeat };
