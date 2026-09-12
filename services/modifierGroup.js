import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly — the tenant-scoping Prisma extension
// injects it from the request context, same as location.service.js.

const groupInclude = { _count: { select: { modifiers: true, products: true } } };

async function createModifierGroup({ name, minSelect, maxSelect }) {
  return prisma.modifierGroup.create({ data: { name, minSelect, maxSelect }, include: groupInclude });
}

async function listModifierGroups({ search, page, limit }) {
  const where = { isActive: true, ...searchFilter(search, ['name']) };

  const [total, groups] = await prisma.$transaction([
    prisma.modifierGroup.count({ where }),
    prisma.modifierGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: groupInclude,
    }),
  ]);

  return { data: groups, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getModifierGroupById(id) {
  const group = await prisma.modifierGroup.findUnique({ where: { id }, include: groupInclude });
  if (!group) throw ApiError.notFound('Modifier group not found');
  return group;
}

async function updateModifierGroup(id, updates) {
  await getModifierGroupById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.modifierGroup.update({ where: { id }, data: updates, include: groupInclude });
}

async function deactivateModifierGroup(id) {
  const group = await getModifierGroupById(id);
  if (!group.isActive) {
    throw ApiError.conflict('Modifier group is already inactive');
  }
  return prisma.modifierGroup.update({ where: { id }, data: { isActive: false } });
}

async function reactivateModifierGroup(id) {
  const group = await getModifierGroupById(id);
  if (group.isActive) {
    throw ApiError.conflict('Modifier group is already active');
  }
  return prisma.modifierGroup.update({ where: { id }, data: { isActive: true } });
}

export default {
  createModifierGroup,
  listModifierGroups,
  getModifierGroupById,
  updateModifierGroup,
  deactivateModifierGroup,
  reactivateModifierGroup,
};
