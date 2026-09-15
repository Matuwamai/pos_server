import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import roleService from './role.js';
import smsOtpService from './smsOtp.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const MFA_TOKEN_EXPIRES_IN = '10m';
const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function signToken(user) {
  // `type: 'tenant_user'` mirrors the super-admin token's `type` claim —
  // keeps the two token kinds from being interchangeable even if a secret
  // were ever shared by mistake.
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, role: user.role, type: 'tenant_user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// A short-lived, single-purpose token identifying "this user passed
// password auth and is mid-MFA-challenge" — never usable as a real session
// token (authenticate.js only accepts type 'tenant_user'), so it can be
// handed back to the client without granting any access on its own.
function signMfaToken(user) {
  return jwt.sign({ sub: user.id, type: 'mfa_pending' }, JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN });
}

function verifyMfaToken(mfaToken) {
  let payload;
  try {
    payload = jwt.verify(mfaToken, JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired MFA session — please log in again');
  }
  if (payload.type !== 'mfa_pending') {
    throw ApiError.unauthorized('Invalid MFA session');
  }
  return payload;
}

async function signup({ tenantName, subdomain, ownerName, ownerEmail, ownerPassword }) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    throw ApiError.conflict('That subdomain is already taken');
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const { tenant, owner } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, subdomain, plan: 'trial' },
    });

    await tx.location.create({
      data: { tenantId: tenant.id, name: 'Main Location' },
    });

    // Every tenant needs a Subscription row for authenticate.js's billing
    // check to pass at all — without one, a brand-new tenant would be
    // locked out before ever using the product. billingProvider stays
    // 'none' until a real provider is wired up (see services/subscription.js).
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode: 'trial',
        billingProvider: 'none',
        currentPeriodEnd: new Date(Date.now() + TRIAL_LENGTH_MS),
      },
    });

    // Seeds the 5 default roles (config/defaultRolePermissions.js) for this
    // tenant so the owner has a real, editable Role from day one instead of
    // only ever having the legacy enum value.
    const roleIdByName = await roleService.seedDefaultRolesForTenant(tx, tenant.id);

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: 'OWNER',
        assignedRoleId: roleIdByName.OWNER,
      },
    });

    return { tenant, owner };
  });

  const token = signToken(owner);
  return { token, tenant, user: sanitize(owner) };
}

async function login({ subdomain, email, password }) {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (user.mfaEnabled) {
    await smsOtpService.issueOtp(user, 'OTP');
    return { mfaRequired: true, mfaToken: signMfaToken(user) };
  }

  const token = signToken(user);
  return { token, user: sanitize(user) };
}

async function verifyLoginOtp({ mfaToken, code }) {
  const payload = verifyMfaToken(mfaToken);

  await smsOtpService.verifyOtp(payload.sub, code);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const token = signToken(user);
  return { token, user: sanitize(user) };
}

async function resendLoginOtp({ mfaToken }) {
  const payload = verifyMfaToken(mfaToken);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  await smsOtpService.issueOtp(user, 'OTP_RESEND');
  return { mfaRequired: true, mfaToken: signMfaToken(user) };
}

function sanitize(user) {
  const { passwordHash, ...safe } = user; // eslint-disable-line no-unused-vars
  return safe;
}

export default { signup, login, verifyLoginOtp, resendLoginOtp };
