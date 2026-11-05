import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import customerService from './customer.js';
import loyaltyProgramService from './loyaltyProgram.js';
import auditLogService from './auditLog.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

async function getPointsBalance(customerId) {
  await customerService.getCustomerById(customerId); 
  const result = await prisma.loyaltyTransaction.aggregate({ where: { customerId }, _sum: { points: true } });
  return result._sum.points ?? 0;
}

async function assertProgramActive() {
  const program = await loyaltyProgramService.getLoyaltyProgram(); 
  if (!program.isActive) {
    throw ApiError.conflict('The loyalty program is not currently active');
  }
}

async function assertOrderBelongsToTenant(orderId) {
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
}

async function earnPoints({ customerId, orderId, points }) {
  await assertProgramActive();
  await customerService.getCustomerById(customerId); 
  await assertOrderBelongsToTenant(orderId);
  return prisma.loyaltyTransaction.create({ data: { customerId, orderId, type: 'EARN', points } });
}

async function redeemPoints({ customerId, orderId, points }) {
  await assertProgramActive();
  await customerService.getCustomerById(customerId);
  await assertOrderBelongsToTenant(orderId);

  return prisma.$transaction(async (tx) => {
    const result = await tx.loyaltyTransaction.aggregate({ where: { customerId }, _sum: { points: true } });
    const balance = result._sum.points ?? 0;
    if (points > balance) {
      throw ApiError.conflict(`Insufficient points: only ${balance} available`);
    }
    return tx.loyaltyTransaction.create({ data: { customerId, orderId, type: 'REDEEM', points: -points } });
  });
}

async function adjustPoints({ customerId, points }, actingUser) {
  await assertProgramActive();
  await customerService.getCustomerById(customerId);

  return prisma.$transaction(async (tx) => {
    const result = await tx.loyaltyTransaction.aggregate({ where: { customerId }, _sum: { points: true } });
    const balance = result._sum.points ?? 0;
    if (balance + points < 0) {
      throw ApiError.conflict(`This adjustment would take the balance negative (currently ${balance})`);
    }
    const txn = await tx.loyaltyTransaction.create({ data: { customerId, type: 'ADJUSTMENT', points } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'loyalty.adjust',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { points, loyaltyTransactionId: txn.id },
    });
    return txn;
  });
}

async function listTransactions({ customerId, type, page, limit }) {
  const where = { ...(customerId ? { customerId } : {}), ...(type ? { type } : {}) };

  const [total, transactions] = await prisma.$transaction([
    prisma.loyaltyTransaction.count({ where }),
    prisma.loyaltyTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  return { data: transactions, pagination: buildPaginationMeta({ page, limit, total }) };
}

export default { getPointsBalance, earnPoints, redeemPoints, adjustPoints, listTransactions };
