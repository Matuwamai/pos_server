import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { runWithTenant } from '../config/tenantContext.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Verifies a tenant-user JWT (obtained via POST /api/v1/auth/login). Checked
// against JWT_SECRET — a SEPARATE secret from SUPER_ADMIN_JWT_SECRET — so a
// compromised tenant token can never be replayed against super-admin routes,
// and vice versa, even without the `type` claim check below.
//
// Trusts tenantId/sub/role (the legacy enum) straight from the JWT, same
// tradeoff requireSuperAdmin.js makes. But tenant status, subscription
// standing, the user's own isActive flag, and — new here — permissions are
// ALL re-derived from the database on every request in one query: a
// suspended tenant, a lapsed subscription, a deactivated user, or a
// permission an owner just revoked all need to take effect immediately,
// not just at next login.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  if (payload.type !== 'tenant_user') {
    throw ApiError.forbidden('Tenant access required');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      isActive: true,
      tenant: {
        select: {
          status: true,
          subscription: { select: { status: true, planCode: true, currentPeriodEnd: true } },
        },
      },
      assignedRole: {
        select: { isActive: true, permissions: { select: { permission: { select: { code: true } } } } },
      },
    },
  });
  if (!user) {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  if (!user.tenant || user.tenant.status !== 'ACTIVE') {
    throw ApiError.forbidden('This tenant account is not active');
  }
  if (!user.isActive) {
    throw ApiError.unauthorized('This user account is no longer active');
  }

  // The webhook (services/subscription.js) is the primary way this stays
  // current; currentPeriodEnd is checked here too as a fallback for a
  // missed/delayed webhook, so a lapsed period can never grant access just
  // because the provider hasn't told us yet.
  const subscription = user.tenant.subscription;
  const billingOk =
    subscription &&
    ['trialing', 'active'].includes(subscription.status) &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date());
  if (!billingOk) {
    throw ApiError.paymentRequired('Your subscription has expired. Please renew to continue.', {
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }

  // Empty until the user is assigned a dynamic Role (or if that role gets
  // deactivated) — harmless today since no route checks req.permissions
  // yet, see middlewares/requirePermission.js.
  const permissions =
    user.assignedRole && user.assignedRole.isActive
      ? new Set(user.assignedRole.permissions.map((rp) => rp.permission.code))
      : new Set();

  req.tenantId = payload.tenantId;
  req.user = { id: payload.sub, role: payload.role };
  req.planCode = subscription.planCode;
  req.permissions = permissions;

  runWithTenant(payload.tenantId, next);
});

export default authenticate;
