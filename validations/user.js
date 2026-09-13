import { z } from 'zod';

const idParams = z.object({ id: z.string().uuid() });
const roleEnum = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT']);

const create = {
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: roleEnum,
    pinCode: z.string().min(4).max(12).optional(),
    commissionRate: z.coerce.number().min(0).max(1).optional(),
  }),
};

const getById = {
  params: idParams,
};

const list = {
  query: z.object({
    search: z.string().min(1).max(120).optional(), // matches against name OR email
    role: roleEnum.optional(),
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
      email: z.string().email().optional(),
      role: roleEnum.optional(),
      pinCode: z.string().min(4).max(12).nullable().optional(),
      commissionRate: z.coerce.number().min(0).max(1).nullable().optional(),
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

const changeOwnPassword = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
};

const resetPassword = {
  params: idParams,
  body: z.object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
};

export default { create, getById, list, update, deactivate, reactivate, changeOwnPassword, resetPassword };
