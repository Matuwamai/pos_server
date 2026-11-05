import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

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
