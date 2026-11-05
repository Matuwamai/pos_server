import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const categoryInclude = {
  parent: { select: { id: true, name: true } },
  _count: { select: { children: true, products: true } },
};

async function assertParentBelongsToTenant(parentId, ownId) {
  if (!parentId) return;
  if (parentId === ownId) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw ApiError.notFound('Parent category not found');
}

async function createCategory({ name, parentId }) {
  await assertParentBelongsToTenant(parentId, null);
  return prisma.category.create({ data: { name, parentId }, include: categoryInclude });
}

async function listCategories({ search, parentId, page, limit }) {
  const where = {
    isActive: true,
    ...(parentId ? { parentId } : {}),
    ...searchFilter(search, ['name']),
  };

  const [total, categories] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: categoryInclude,
    }),
  ]);

  return { data: categories, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({ where: { id }, include: categoryInclude });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

async function updateCategory(id, updates) {
  await getCategoryById(id); 
  if (updates.parentId) {
    await assertParentBelongsToTenant(updates.parentId, id);
  }
  return prisma.category.update({ where: { id }, data: updates, include: categoryInclude });
}

async function deactivateCategory(id) {
  const category = await getCategoryById(id);
  if (!category.isActive) {
    throw ApiError.conflict('Category is already inactive');
  }
  return prisma.category.update({ where: { id }, data: { isActive: false } });
}

async function reactivateCategory(id) {
  const category = await getCategoryById(id);
  if (category.isActive) {
    throw ApiError.conflict('Category is already active');
  }
  return prisma.category.update({ where: { id }, data: { isActive: true } });
}

async function findOrCreateByName(name) {
  if (!name) return null;
  const existing = await prisma.category.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.category.create({ data: { name } });
}

export default {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deactivateCategory,
  reactivateCategory,
  findOrCreateByName,
};
