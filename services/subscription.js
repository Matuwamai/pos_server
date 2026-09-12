import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

// Called from the billing webhook (controllers/billing.js) in response to
// provider events. Never called mid-request from a tenant's own session —
// there's no ALS tenant context here, so every call must address the row by
// tenantId explicitly (the tenant-scoping Prisma extension only auto-scopes
// when a context is set; see config/prismaClient.js).

async function getByTenantId(tenantId) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw ApiError.notFound('No subscription found for this tenant');
  return subscription;
}

async function activate({ tenantId, planCode, currentPeriodEnd, externalCustomerId, externalSubId }) {
  await getByTenantId(tenantId);
  return prisma.subscription.update({
    where: { tenantId },
    data: {
      status: 'active',
      ...(planCode ? { planCode } : {}),
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      ...(externalCustomerId ? { externalCustomerId } : {}),
      ...(externalSubId ? { externalSubId } : {}),
    },
  });
}

async function renew({ tenantId, currentPeriodEnd }) {
  await getByTenantId(tenantId);
  return prisma.subscription.update({
    where: { tenantId },
    data: { status: 'active', currentPeriodEnd },
  });
}

async function markPastDue({ tenantId }) {
  await getByTenantId(tenantId);
  return prisma.subscription.update({ where: { tenantId }, data: { status: 'past_due' } });
}

async function cancel({ tenantId }) {
  await getByTenantId(tenantId);
  return prisma.subscription.update({ where: { tenantId }, data: { status: 'cancelled' } });
}

export default { getByTenantId, activate, renew, markPastDue, cancel };
