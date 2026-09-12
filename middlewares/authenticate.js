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
// Tenant status IS re-checked against the database on every request, since
// that's the entire point of the suspend/cancel endpoints — a suspended
// tenant's users must be locked out immediately, not just at next login.
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
    select: { status: true },
  });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw ApiError.forbidden('This tenant account is not active');
  }

  req.tenantId = payload.tenantId;
  req.user = { id: payload.sub, role: payload.role };

  runWithTenant(payload.tenantId, next);
});

export default authenticate;
