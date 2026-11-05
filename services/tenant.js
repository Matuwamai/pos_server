import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import roleService from './role.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';
 
async function createTenant({ name, subdomain, plan }) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    throw ApiError.conflict('That subdomain is already taken');
  }

  const planCode = plan || 'trial';

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, subdomain, plan: planCode },
    });
    await tx.location.create({
      data: { tenantId: tenant.id, name: 'Main Location' },
    });
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode,
        billingProvider: 'none',
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await roleService.seedDefaultRolesForTenant(tx, tenant.id);

    return tenant;
  });
}
 
async function getTenantById(id) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true, locations: true, orders: true },
      },
    },
  });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  return tenant;
}

async function listTenants({ search, status, plan, page, limit, sortBy, sortOrder }) {
  const where = {
    ...(status ? { status } : {}),
    ...(plan ? { plan } : {}),
    ...searchFilter(search, ['name', 'subdomain']),
  };

  const [total, tenants] = await prisma.$transaction([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      ...getPagination({ page, limit }),
      include: {
        _count: { select: { users: true, locations: true } },
      },
    }),
  ]);

  return {
    data: tenants,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}
 
async function updateTenant(id, updates) {
  await getTenantById(id); 
  return prisma.tenant.update({ where: { id }, data: updates });
}
 
async function suspendTenant(id, reason) {
  const tenant = await getTenantById(id);
  if (tenant.status === 'SUSPENDED') {
    throw ApiError.conflict('Tenant is already suspended');
  }
  if (tenant.status === 'CANCELLED') {
    throw ApiError.conflict('Cannot suspend a cancelled tenant');
  }

  return prisma.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
}
 
async function reactivateTenant(id) {
  const tenant = await getTenantById(id);
  if (tenant.status === 'ACTIVE') {
    throw ApiError.conflict('Tenant is already active');
  }
  if (tenant.status === 'CANCELLED') {
    throw ApiError.conflict('Cannot reactivate a cancelled tenant');
  }
  return prisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
}
 
async function cancelTenant(id, reason) {
  const tenant = await getTenantById(id);
  if (tenant.status === 'CANCELLED') {
    throw ApiError.conflict('Tenant is already cancelled');
  }
  return prisma.tenant.update({ where: { id }, data: { status: 'CANCELLED' } });
}
 
export default {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  cancelTenant,
};
 