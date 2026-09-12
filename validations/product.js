import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const attributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional();

const variantInput = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().min(1).max(64).optional(),
  attributes: attributesSchema,
  price: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative().optional(),
  taxRateId: z.string().uuid().optional(),
});

// Every product must have at least one variant — see schema.prisma's note
// on the catalog being variant-centric. There's no "create a bare product"
// endpoint; a default variant is required up front, same as onboarding
// always creates a tenant's first location/subscription alongside it.
const create = {
  body: z.object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    isComposite: z.coerce.boolean().optional(),
    trackInventory: z.coerce.boolean().optional(),
    variants: z.array(variantInput).min(1, 'At least one variant is required'),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR description
    categoryId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const update = {
  params: idParams,
  body: z
    .object({
      categoryId: z.string().uuid().nullable().optional(),
      name: z.string().min(1).max(160).optional(),
      description: z.string().max(2000).optional(),
      isComposite: z.coerce.boolean().optional(),
      trackInventory: z.coerce.boolean().optional(),
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

const attachModifierGroup = {
  params: idParams,
  body: z.object({ modifierGroupId: z.string().uuid() }),
};

const detachModifierGroup = {
  params: z.object({ id: z.string().uuid(), modifierGroupId: z.string().uuid() }),
};

export default {
  create,
  getById,
  list,
  update,
  deactivate,
  reactivate,
  attachModifierGroup,
  detachModifierGroup,
  variantInput,
};
