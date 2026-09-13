import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getTenantId } from '../config/tenantContext.js';
import auditLogService from './auditLog.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

// Payment has no tenantId of its own — a line item reachable only via its
// parent Order, same shape as OrderItem — so the tenant-scoping Prisma
// extension can't auto-scope it. Every query here filters through the
// Order relation by hand instead of relying on that safety net.

const paymentInclude = {
  order: { select: { id: true, orderNumber: true, locationId: true, customerId: true, status: true } },
};

function buildWhere({ orderId, locationId, method, status, dateFrom, dateTo }) {
  return {
    order: { tenantId: getTenantId(), ...(locationId ? { locationId } : {}) },
    ...(orderId ? { orderId } : {}),
    ...(method ? { method } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
      : {}),
  };
}

async function listPayments(filters) {
  const where = buildWhere(filters);
  const { page, limit } = filters;

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...getPagination({ page, limit }),
      include: paymentInclude,
    }),
  ]);

  return { data: payments, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getPaymentById(id) {
  const payment = await prisma.payment.findFirst({ where: { id, order: { tenantId: getTenantId() } }, include: paymentInclude });
  if (!payment) throw ApiError.notFound('Payment not found');
  return payment;
}

// A manual reconciliation lever for when an automatic capture/webhook never
// updates a payment correctly (or updates it wrong) — corrects only THIS
// record's status. Deliberately doesn't cascade into inventory, loyalty, or
// any other ledger; a payment that actually needs the sale unwound belongs
// in orderService.refundOrder, which already handles those effects properly.
async function updatePaymentStatus(id, { status, note }, actingUser) {
  const payment = await getPaymentById(id);
  if (payment.status === status) {
    throw ApiError.conflict(`Payment is already ${status}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({ where: { id }, data: { status } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'payment.status_override',
      entityType: 'Payment',
      entityId: id,
      metadata: { from: payment.status, to: status, note },
    });
    return updated;
  });
}

export default { listPayments, getPaymentById, updatePaymentStatus };
