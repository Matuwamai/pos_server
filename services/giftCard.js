import crypto from 'crypto';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import customerService from './customer.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const giftCardInclude = { issuedTo: { select: { id: true, name: true } } };

function generateCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 hex chars
}

async function assertOrderBelongsToTenant(orderId) {
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
}

function assertUsable(giftCard) {
  if (!giftCard.isActive) throw ApiError.conflict('This gift card is not active');
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) throw ApiError.conflict('This gift card has expired');
}

// Same shape as storeCreditTransaction's applyStoreCreditChange: updates the
// GiftCard.currentBalance snapshot and writes the ledger row (with
// balanceAfter as a point-in-time audit snapshot) in one transaction.
// GiftCardTransaction has no tenantId of its own — giftCard was already
// resolved through a tenant-scoped lookup before this is called.
async function applyGiftCardChange(tx, { giftCard, type, amount, orderId }) {
  const newBalance = Number(giftCard.currentBalance) + amount;
  if (newBalance < 0) {
    throw ApiError.conflict(`Insufficient gift card balance: only ${giftCard.currentBalance} available`);
  }

  await tx.giftCard.update({ where: { id: giftCard.id }, data: { currentBalance: { increment: amount } } });
  return tx.giftCardTransaction.create({
    data: { giftCardId: giftCard.id, orderId, type, amount, balanceAfter: newBalance },
  });
}

async function issueGiftCard({ code, initialBalance, issuedToCustomerId, expiresAt }) {
  if (issuedToCustomerId) {
    await customerService.getCustomerById(issuedToCustomerId); // 404s if missing/foreign tenant
  }

  const finalCode = code || generateCode();
  const existing = await prisma.giftCard.findFirst({ where: { code: finalCode } });
  if (existing) throw ApiError.conflict('That code is already in use');

  const giftCardId = await prisma.$transaction(async (tx) => {
    const giftCard = await tx.giftCard.create({
      data: { code: finalCode, initialBalance, currentBalance: initialBalance, issuedToCustomerId, expiresAt },
    });
    await tx.giftCardTransaction.create({
      data: { giftCardId: giftCard.id, type: 'ISSUE', amount: initialBalance, balanceAfter: initialBalance },
    });
    return giftCard.id;
  });

  return getGiftCardById(giftCardId);
}

async function getGiftCardById(id) {
  const giftCard = await prisma.giftCard.findUnique({ where: { id }, include: giftCardInclude });
  if (!giftCard) throw ApiError.notFound('Gift card not found');
  return giftCard;
}

async function getCardByCode(code) {
  const giftCard = await prisma.giftCard.findFirst({ where: { code } });
  if (!giftCard) throw ApiError.notFound('Gift card not found');
  return giftCard;
}

async function listGiftCards({ search, isActive, issuedToCustomerId, page, limit }) {
  const where = {
    ...(isActive !== undefined ? { isActive } : {}),
    ...(issuedToCustomerId ? { issuedToCustomerId } : {}),
    ...searchFilter(search, ['code']),
  };

  const [total, giftCards] = await prisma.$transaction([
    prisma.giftCard.count({ where }),
    prisma.giftCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: giftCardInclude,
    }),
  ]);

  return { data: giftCards, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function redeemGiftCard({ code, orderId, amount }) {
  await assertOrderBelongsToTenant(orderId);
  const giftCard = await getCardByCode(code);
  assertUsable(giftCard);
  return prisma.$transaction((tx) => applyGiftCardChange(tx, { giftCard, type: 'REDEEM', amount: -amount, orderId }));
}

async function reloadGiftCard({ code, amount }) {
  const giftCard = await getCardByCode(code);
  assertUsable(giftCard);
  return prisma.$transaction((tx) => applyGiftCardChange(tx, { giftCard, type: 'RELOAD', amount }));
}

// Admin correction — deliberately bypasses the active/expiry checks that
// gate redeem/reload, same reasoning as loyalty/store-credit adjustments.
async function adjustGiftCard(id, amount) {
  const giftCard = await getGiftCardById(id);
  return prisma.$transaction((tx) => applyGiftCardChange(tx, { giftCard, type: 'ADJUSTMENT', amount }));
}

async function deactivateGiftCard(id) {
  const giftCard = await getGiftCardById(id);
  if (!giftCard.isActive) throw ApiError.conflict('Gift card is already inactive');
  return prisma.giftCard.update({ where: { id }, data: { isActive: false } });
}

async function reactivateGiftCard(id) {
  const giftCard = await getGiftCardById(id);
  if (giftCard.isActive) throw ApiError.conflict('Gift card is already active');
  return prisma.giftCard.update({ where: { id }, data: { isActive: true } });
}

async function listTransactions(giftCardId) {
  await getGiftCardById(giftCardId); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.giftCardTransaction.findMany({ where: { giftCardId }, orderBy: { createdAt: 'desc' } });
}

export default {
  applyGiftCardChange,
  assertUsable,
  issueGiftCard,
  getGiftCardById,
  getCardByCode,
  listGiftCards,
  redeemGiftCard,
  reloadGiftCard,
  adjustGiftCard,
  deactivateGiftCard,
  reactivateGiftCard,
  listTransactions,
};
