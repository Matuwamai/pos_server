import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { runWithTenant } from '../config/tenantContext.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import authenticate from './authenticate.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Terminal device tokens carry no user: a till's cashier is established
// offline (PIN) and sent per-sale, so the device itself gets a fixed,
// narrow permission set rather than a role.
const TERMINAL_PERMISSIONS = new Set(['sync.pull', 'sync.push', 'paymentIntents.create', 'paymentIntents.read']);

// Device tokens are long-lived, so revocation is server-side: every request
// re-checks the terminal row. Bumping tokenVersion (revoke) or deactivating
// the terminal invalidates the token immediately.
export const authenticateTerminal = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw ApiError.unauthorized('Missing or malformed Authorization header');

  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired device token');
  }
  if (payload.type !== 'terminal') throw ApiError.forbidden('Device token required');

  const terminal = await prisma.terminal.findUnique({
    where: { id: payload.sub },
    select: { id: true, tenantId: true, locationId: true, isActive: true, tokenVersion: true, tenant: { select: { status: true, subscription: { select: { status: true, currentPeriodEnd: true } } } } },
  });
  if (!terminal || terminal.tenantId !== payload.tenantId || terminal.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('This device has been revoked — re-enroll it from the web app');
  }
  if (!terminal.isActive) throw ApiError.forbidden('This terminal has been deactivated');
  if (terminal.tenant.status !== 'ACTIVE') throw ApiError.forbidden('This tenant account is not active');

  const sub = terminal.tenant.subscription;
  const billingOk = sub && ['trialing', 'active'].includes(sub.status) && (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date());
  if (!billingOk) throw ApiError.paymentRequired('Your subscription has expired. Please renew to continue.', { code: 'SUBSCRIPTION_EXPIRED' });

  req.tenantId = terminal.tenantId;
  req.terminal = { id: terminal.id, tenantId: terminal.tenantId, locationId: terminal.locationId };
  req.isTerminal = true;
  req.user = null;
  req.permissions = TERMINAL_PERMISSIONS;
  runWithTenant(terminal.tenantId, next);
});

// /sync/pull serves both a till (device token) and the web app's own admin
// tooling (user token), dispatching on the token's declared type.
export const authenticateSyncClient = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : '';
  const decoded = token ? jwt.decode(token) : null;
  if (decoded?.type === 'terminal') return authenticateTerminal(req, res, next);
  return authenticate(req, res, next);
});
