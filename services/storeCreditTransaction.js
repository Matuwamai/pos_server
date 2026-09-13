import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import customerService from './customer.js';
import auditLogService from './auditLog.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// Unlike loyalty points, Customer.storeCreditBalance IS materialized —
// this is the one place that snapshot and the ledger get written together,
// same shape as inventory's applyInventoryChange. `amount` carries its own
// sign (ISSUE/ADJUSTMENT as given, REDEEM negated before it gets here), and
// balanceAfter is stored on the row as a point-in-time snapshot for
// auditing, even though the running balance itself lives on Customer.
async function applyStoreCreditChange(tx, { customerId, orderId, type, amount }) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const newBalance = Number(customer.storeCreditBalance) + amount;
  if (newBalance < 0) {
    throw ApiError.conflict(`Insufficient store credit: only ${customer.storeCreditBalance} available`);
  }

  await tx.customer.update({ where: { id: customerId }, data: { storeCreditBalance: { increment: amount } } });
  return tx.storeCreditTransaction.create({ data: { customerId, orderId, type, amount, balanceAfter: newBalance } });
}

async function assertOrderBelongsToTenant(orderId) {
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound('Order not found');
}

async function issueCredit({ customerId, orderId, amount }) {
  await customerService.getCustomerById(customerId); // 404s if missing/foreign tenant
  await assertOrderBelongsToTenant(orderId);
  return prisma.$transaction((tx) => applyStoreCreditChange(tx, { customerId, orderId, type: 'ISSUE', amount }));
}

async function redeemCredit({ customerId, orderId, amount }) {
  await customerService.getCustomerById(customerId);
  await assertOrderBelongsToTenant(orderId);
  return prisma.$transaction((tx) => applyStoreCreditChange(tx, { customerId, orderId, type: 'REDEEM', amount: -amount }));
}

async function adjustCredit({ customerId, amount }, actingUser) {
  await customerService.getCustomerById(customerId);
  return prisma.$transaction(async (tx) => {
    const txn = await applyStoreCreditChange(tx, { customerId, type: 'ADJUSTMENT', amount });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'storeCredit.adjust',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { amount, storeCreditTransactionId: txn.id },
    });
    return txn;
  });
}

async function listTransactions({ customerId, type, page, limit }) {
  const where = { ...(customerId ? { customerId } : {}), ...(type ? { type } : {}) };

  const [total, transactions] = await prisma.$transaction([
    prisma.storeCreditTransaction.count({ where }),
    prisma.storeCreditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  return { data: transactions, pagination: buildPaginationMeta({ page, limit, total }) };
}

export default { applyStoreCreditChange, issueCredit, redeemCredit, adjustCredit, listTransactions };
