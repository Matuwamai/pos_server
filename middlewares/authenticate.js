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
// Trusts tenantId/userId/role from the token itself rather than re-reading
// the user row on every request (same tradeoff requireSuperAdmin.js makes).
// Tenant status and subscription standing ARE re-checked against the
// database on every request, since that's the entire point of the
// suspend/cancel endpoints and of billing enforcement — a suspended tenant,
// or one whose subscription has lapsed, must be locked out immediately, not
// just at next login.
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

  const tenant = await prisma.tenant.findUnique({
    where: { id: payload.tenantId },
    select: {
      status: true,
      subscription: { select: { status: true, planCode: true, currentPeriodEnd: true } },
    },
  });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw ApiError.forbidden('This tenant account is not active');
  }

  // The webhook (services/subscription.js) is the primary way this stays
  // current; currentPeriodEnd is checked here too as a fallback for a
  // missed/delayed webhook, so a lapsed period can never grant access just
  // because the provider hasn't told us yet.
  const subscription = tenant.subscription;
  const billingOk =
    subscription &&
    ['trialing', 'active'].includes(subscription.status) &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date());
  if (!billingOk) {
    throw ApiError.paymentRequired('Your subscription has expired. Please renew to continue.', {
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }

  req.tenantId = payload.tenantId;
  req.user = { id: payload.sub, role: payload.role };
  req.planCode = subscription.planCode;

  runWithTenant(payload.tenantId, next);
});

export default authenticate;
