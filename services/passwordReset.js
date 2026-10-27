import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient.js';
import { runWithTenant } from '../config/tenantContext.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import smsProviderService from './smsProvider.js';
import emailService from './email.js';
import auditLogService from './auditLog.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000; // per user, between issued codes
const MAX_ATTEMPTS = 5; // guesses allowed per issued code

// HMAC (keyed with the server secret) rather than a bare hash: a 6-digit
// code has only a million possibilities, so an unkeyed hash in a leaked DB
// would be reversed instantly.
function hashCode(code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex');
}

// Pre-authentication, so there's no tenant context yet — resolved from the
// subdomain the same way login does.
async function findActiveUser(subdomain, email) {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant || tenant.status !== 'ACTIVE') return null;
  const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } });
  if (!user || !user.isActive) return null;
  return user;
}

// Prefers SMS when the account has a phone on file, and falls back to email
// if SMS isn't possible or fails. Never throws: delivery problems are logged
// but must not change the response the caller sees (see requestReset).
async function deliverCode(user, code) {
  const resetUrl = `${env.appUrl}/reset-password?subdomain=${encodeURIComponent(user.tenantSubdomain)}&email=${encodeURIComponent(user.email)}`;
  let delivered = false;

  if (user.phone) {
    const result = await smsProviderService.sendSms({
      phone: user.phone,
      message: `Your password reset code is ${code}. It expires in 10 minutes. If you didn't ask for this, ignore it.`,
    });
    delivered = result.success;
  }

  if (!delivered) {
    const result = await emailService.sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      text: `Your password reset code is ${code}. It expires in 10 minutes.\n\nEnter it here: ${resetUrl}\n\nIf you didn't ask for this, you can ignore this email — your password hasn't changed.`,
    });
    delivered = result.success;
  }

  // Same dev-only escape hatch smsOtp.js uses: with no provider configured
  // at all, log the code so the flow is testable locally. Never in production.
  const noProviderConfigured = !smsProviderService.isConfigured() && !emailService.isConfigured();
  if (!delivered && env.nodeEnv !== 'production' && noProviderConfigured) {
    logger.info('[DEV ONLY] No SMS/email provider configured — logging password reset code for testing', { userId: user.id, code });
  } else if (!delivered) {
    logger.error('Password reset code could not be delivered', { userId: user.id });
  }
}

// Always resolves with no information about whether the account exists,
// was throttled, or the code was delivered — otherwise this endpoint would
// let anyone probe which emails/subdomains are registered.
async function requestReset({ subdomain, email }) {
  const user = await findActiveUser(subdomain, email);
  if (!user) return;

  const recent = await prisma.passwordReset.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - REQUEST_COOLDOWN_MS) } },
  });
  if (recent) return;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction([
    // A newly requested code supersedes any earlier one still outstanding.
    prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        channel: user.phone ? 'SMS' : 'EMAIL',
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  // Delivery runs after the response is decided so timing doesn't reveal
  // whether the account existed.
  deliverCode({ ...user, tenantSubdomain: subdomain }, code).catch((err) =>
    logger.error('Password reset delivery crashed', { userId: user.id, message: err.message })
  );
}

async function confirmReset({ subdomain, email, code, newPassword }) {
  const invalid = () => ApiError.badRequest('Invalid or expired code');

  const user = await findActiveUser(subdomain, email);
  if (!user) throw invalid();

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset) throw invalid();

  // Increment first, check the returned value: the increment is atomic, so
  // parallel guesses can't all slip under the limit the way a
  // read-then-write check would allow.
  const counted = await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
  if (counted.attempts > MAX_ATTEMPTS) throw invalid();

  const matches = crypto.timingSafeEqual(Buffer.from(reset.codeHash, 'hex'), Buffer.from(hashCode(code), 'hex'));
  if (!matches) throw invalid();

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Run inside the user's tenant context so the audit-log write is scoped to
  // the right tenant the same way an authenticated request's would be.
  await runWithTenant(user.tenantId, () =>
    prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      });
      await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await auditLogService.recordAuditLog(tx, {
        userId: user.id,
        action: 'user.password_recovered',
        entityType: 'User',
        entityId: user.id,
        metadata: { channel: reset.channel },
      });
    })
  );
}

export default { requestReset, confirmReset };
