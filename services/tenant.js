import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
 
// NOTE ON AUTH: these operations are platform-admin actions that span
// tenants — they are NOT protected by the normal `authenticate` middleware
// (which resolves a single req.tenantId from a tenant-scoped JWT). Routes
// using this service need a separate super-admin auth check. See
// tenant.routes.js for a placeholder middleware and a note on replacing it.
 
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

    // Every tenant gets a default location so onboarding never leaves a
    // tenant in a state where it has no location to attach products/orders
    // to. Businesses can rename or add more locations later.
    await tx.location.create({
      data: { tenantId: tenant.id, name: 'Main Location' },
    });

    // Also required so authenticate.js's billing check doesn't lock this
    // tenant out before it has any real billing set up — mirrors the
    // self-signup flow in auth.service.js. A super admin can move it off
    // the trial period via the billing webhook/service once it's paying.
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode,
        billingProvider: 'none',
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

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
 
// Fetch-many with search (name OR subdomain, case-insensitive), optional
// status/plan filters, and pagination.
async function listTenants({ search, status, plan, page, limit, sortBy, sortOrder }) {
  const where = {
    ...(status ? { status } : {}),
    ...(plan ? { plan } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { subdomain: { contains: search } },
          ],
        }
      : {}),
  };
 
  const [total, tenants] = await prisma.$transaction([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { users: true, locations: true } },
      },
    }),
  ]);
 
  return {
    data: tenants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
 
async function updateTenant(id, updates) {
  await getTenantById(id); // ensures it exists, 404s otherwise
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
  // `reason` is accepted for audit logging at the controller/route level;
  // the Tenant row itself only tracks current status, not history.
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
  // Cancellation is terminal and deliberately does NOT delete any data —
  // orders/payments/customers must survive for financial/legal record
  // keeping even after a business leaves the platform. There is no hard
  // delete endpoint for tenants for this reason.
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
 