import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import roleService from './role.js';
import smsOtpService from './smsOtp.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const MFA_TOKEN_EXPIRES_IN = '10m';
const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000; 

function signToken(user) {
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, role: user.role, type: 'tenant_user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

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

async function signup({ tenantName, subdomain, currency, ownerName, ownerEmail, ownerPassword }) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    throw ApiError.conflict('That subdomain is already taken');
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const { tenant, owner } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, subdomain, currency, plan: 'trial' },
    });

    await tx.location.create({
      data: { tenantId: tenant.id, name: 'Main Location' },
    });

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode: 'trial',
        billingProvider: 'none',
        currentPeriodEnd: new Date(Date.now() + TRIAL_LENGTH_MS),
      },
    });

  
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
  const { passwordHash, ...safe } = user; 
  return safe;
}

export default { signup, login, verifyLoginOtp, resendLoginOtp, signToken };
