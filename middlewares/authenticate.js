import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { runWithTenant } from '../config/tenantContext.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const JWT_SECRET = process.env.JWT_SECRET;
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
      mustChangePassword: true,
      passwordChangedAt: true,
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
  if (user.passwordChangedAt && payload.iat * 1000 < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
    throw ApiError.unauthorized('Your password was changed — please sign in again');
  }
  if (user.mustChangePassword) {
    const path = req.originalUrl.split('?')[0];
    const allowed =
      (req.method === 'GET' && path === '/api/v1/users/me') ||
      (req.method === 'POST' && path === '/api/v1/users/me/change-password');
    if (!allowed) {
      throw new ApiError(403, 'You must change your password before continuing', { code: 'PASSWORD_CHANGE_REQUIRED' });
    }
  }
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
