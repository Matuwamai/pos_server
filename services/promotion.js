import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

async function assertCodeAvailable(code, excludeId) {
  if (!code) return;
  const existing = await prisma.promotion.findFirst({ where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (existing) throw ApiError.conflict('That promotion code is already in use');
}

async function createPromotion(data) {
  await assertCodeAvailable(data.code);
  return prisma.promotion.create({ data });
}

async function listPromotions({ search, isActive, type, page, limit }) {
  const where = {
    ...(isActive !== undefined ? { isActive } : {}),
    ...(type ? { type } : {}),
    ...searchFilter(search, ['name', 'code']),
  };

  const [total, promotions] = await prisma.$transaction([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({ where, orderBy: { createdAt: 'desc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: promotions, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getPromotionById(id) {
  const promotion = await prisma.promotion.findUnique({ where: { id } });
  if (!promotion) throw ApiError.notFound('Promotion not found');
  return promotion;
}

async function updatePromotion(id, updates) {
  await getPromotionById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  if (updates.code) {
    await assertCodeAvailable(updates.code, id);
  }
  return prisma.promotion.update({ where: { id }, data: updates });
}

async function deactivatePromotion(id) {
  const promotion = await getPromotionById(id);
  if (!promotion.isActive) {
    throw ApiError.conflict('Promotion is already inactive');
  }
  return prisma.promotion.update({ where: { id }, data: { isActive: false } });
}

async function reactivatePromotion(id) {
  const promotion = await getPromotionById(id);
  if (promotion.isActive) {
    throw ApiError.conflict('Promotion is already active');
  }
  return prisma.promotion.update({ where: { id }, data: { isActive: true } });
}

function assertPromotionValid(promotion) {
  const now = new Date();
  if (!promotion.isActive) throw ApiError.conflict('This promotion is not active');
  if (promotion.startsAt && promotion.startsAt > now) throw ApiError.conflict('This promotion has not started yet');
  if (promotion.endsAt && promotion.endsAt < now) throw ApiError.conflict('This promotion has ended');
}

// Used at checkout to validate a coupon code — and, once Order creation
// exists, reused there to actually apply it. Checked here now so the
// active/date-window logic exists in exactly one place.
async function getValidPromotionByCode(code) {
  const promotion = await prisma.promotion.findFirst({ where: { code } });
  if (!promotion) throw ApiError.notFound('Promotion code not found');
  assertPromotionValid(promotion);
  return promotion;
}

export default {
  createPromotion,
  listPromotions,
  getPromotionById,
  updatePromotion,
  deactivatePromotion,
  reactivatePromotion,
  getValidPromotionByCode,
};
