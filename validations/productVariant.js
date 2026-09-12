import { z } from 'zod';
import productValidation from './product.js';

const productIdParam = z.object({ productId: z.string().uuid() });
const variantIdParams = z.object({ productId: z.string().uuid(), variantId: z.string().uuid() });
const componentIdParams = variantIdParams.extend({ componentId: z.string().uuid() });

const addVariant = {
  params: productIdParam,
  body: productValidation.variantInput,
};

const getById = {
  params: variantIdParams,
};

const update = {
  params: variantIdParams,
  body: z
    .object({
      sku: z.string().min(1).max(64).optional(),
      barcode: z.string().min(1).max(64).optional(),
      attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      price: z.coerce.number().nonnegative().optional(),
      cost: z.coerce.number().nonnegative().optional(),
      taxRateId: z.string().uuid().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

const deactivate = {
  params: variantIdParams,
};

const reactivate = {
  params: variantIdParams,
};

const addComponent = {
  params: variantIdParams,
  body: z.object({
    componentVariantId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
  }),
};

const listComponents = {
  params: variantIdParams,
};

const removeComponent = {
  params: componentIdParams,
};

export default { addVariant, getById, update, deactivate, reactivate, addComponent, listComponents, removeComponent };
