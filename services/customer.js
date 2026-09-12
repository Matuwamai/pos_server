import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import customerGroupService from './customerGroup.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly — the tenant-scoping Prisma extension
// injects it from the request context, same as location.service.js.

const customerInclude = {
  customerGroup: { select: { id: true, name: true, discountPercentage: true } },
  _count: { select: { orders: true } },
};

async function assertGroupBelongsToTenant(customerGroupId) {
  if (customerGroupId) {
    await customerGroupService.getCustomerGroupById(customerGroupId); // 404s if missing/foreign tenant
  }
}

async function createCustomer({ customerGroupId, name, email, phone, marketingOptIn }) {
  await assertGroupBelongsToTenant(customerGroupId);
  return prisma.customer.create({
    data: { customerGroupId, name, email, phone, marketingOptIn },
    include: customerInclude,
  });
}

async function listCustomers({ search, customerGroupId, page, limit }) {
  const where = {
    isActive: true,
    ...(customerGroupId ? { customerGroupId } : {}),
    ...searchFilter(search, ['name', 'email', 'phone']),
  };

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: customerInclude,
    }),
  ]);

  return { data: customers, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getCustomerById(id) {
  const customer = await prisma.customer.findUnique({ where: { id }, include: customerInclude });
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
}

async function updateCustomer(id, updates) {
  await getCustomerById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  if (updates.customerGroupId) {
    await assertGroupBelongsToTenant(updates.customerGroupId);
  }
  return prisma.customer.update({ where: { id }, data: updates, include: customerInclude });
}

async function deactivateCustomer(id) {
  const customer = await getCustomerById(id);
  if (!customer.isActive) {
    throw ApiError.conflict('Customer is already inactive');
  }
  return prisma.customer.update({ where: { id }, data: { isActive: false } });
}

async function reactivateCustomer(id) {
  const customer = await getCustomerById(id);
  if (customer.isActive) {
    throw ApiError.conflict('Customer is already active');
  }
  return prisma.customer.update({ where: { id }, data: { isActive: true } });
}

export default {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
};
