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
const REQUEST_COOLDOWN_MS = 60 * 1000; 
const MAX_ATTEMPTS = 5; 


function hashCode(code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex');
}

async function findActiveUser(subdomain, email) {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant || tenant.status !== 'ACTIVE') return null;
  const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } });
  if (!user || !user.isActive) return null;
  return user;
}

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
  const noProviderConfigured = !smsProviderService.isConfigured() && !emailService.isConfigured();
  if (!delivered && env.nodeEnv !== 'production' && noProviderConfigured) {
    logger.info('[DEV ONLY] No SMS/email provider configured — logging password reset code for testing', { userId: user.id, code });
  } else if (!delivered) {
    logger.error('Password reset code could not be delivered', { userId: user.id });
  }
}

async function requestReset({ subdomain, email }) {
  const user = await findActiveUser(subdomain, email);
  if (!user) return;

  const recent = await prisma.passwordReset.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - REQUEST_COOLDOWN_MS) } },
  });
  if (recent) return;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction([
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

  const counted = await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
  if (counted.attempts > MAX_ATTEMPTS) throw invalid();

  const matches = crypto.timingSafeEqual(Buffer.from(reset.codeHash, 'hex'), Buffer.from(hashCode(code), 'hex'));
  if (!matches) throw invalid();

  const passwordHash = await bcrypt.hash(newPassword, 10);

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
