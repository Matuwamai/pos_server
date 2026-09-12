import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly — the tenant-scoping Prisma extension
// injects it from the request context, same as location.service.js.

async function createCustomerGroup({ name, discountPercentage }) {
  return prisma.customerGroup.create({ data: { name, discountPercentage } });
}

async function listCustomerGroups({ search, page, limit }) {
  const where = { isActive: true, ...searchFilter(search, ['name']) };

  const [total, groups] = await prisma.$transaction([
    prisma.customerGroup.count({ where }),
    prisma.customerGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: { _count: { select: { customers: true } } },
    }),
  ]);

  return { data: groups, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getCustomerGroupById(id) {
  const group = await prisma.customerGroup.findUnique({
    where: { id },
    include: { _count: { select: { customers: true } } },
  });
  if (!group) throw ApiError.notFound('Customer group not found');
  return group;
}

async function updateCustomerGroup(id, updates) {
  await getCustomerGroupById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.customerGroup.update({ where: { id }, data: updates });
}

async function deactivateCustomerGroup(id) {
  const group = await getCustomerGroupById(id);
  if (!group.isActive) {
    throw ApiError.conflict('Customer group is already inactive');
  }
  return prisma.customerGroup.update({ where: { id }, data: { isActive: false } });
}

async function reactivateCustomerGroup(id) {
  const group = await getCustomerGroupById(id);
  if (group.isActive) {
    throw ApiError.conflict('Customer group is already active');
  }
  return prisma.customerGroup.update({ where: { id }, data: { isActive: true } });
}

export default {
  createCustomerGroup,
  listCustomerGroups,
  getCustomerGroupById,
  updateCustomerGroup,
  deactivateCustomerGroup,
  reactivateCustomerGroup,
};
