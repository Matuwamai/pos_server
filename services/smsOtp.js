import crypto from 'crypto';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import smsProviderService from './smsProvider.js';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds between issues for the same user

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
}

// Called pre-authentication (no ALS tenant context exists yet during
// login), so tenantId is always taken explicitly from the caller — same
// reasoning as every other pre-auth write in auth.service.js.
async function issueOtp(user, eventType = 'OTP') {
  if (!user.phone) {
    throw ApiError.badRequest('This account has no phone number on file for MFA');
  }

  const recent = await prisma.smsOtp.findFirst({
    where: { userId: user.id, isUsed: false, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    throw ApiError.tooManyRequests('Please wait before requesting another code');
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const otp = await prisma.smsOtp.create({ data: { userId: user.id, phone: user.phone, code, expiresAt } });

  const message = `Your verification code is ${code}. It expires in 5 minutes.`;
  const result = await smsProviderService.sendSms({ phone: user.phone, message });

  // Without this, enabling MFA before real credentials are connected would
  // be a one-way trip to a locked account: login itself would fail before
  // ever issuing a JWT, so there'd be no way to log back in and turn MFA
  // off again. Non-production only, and only when the provider genuinely
  // isn't configured (a real send failure in prod still fails loudly below)
  // — logging a live OTP code is a real exception to "never log secrets",
  // justified only for local/dev testing of this exact flow.
  const devFallback = env.nodeEnv !== 'production' && !smsProviderService.isConfigured();
  if (devFallback) {
    logger.info('[DEV ONLY] SMS provider not configured — logging OTP for testing', { userId: user.id, code });
  }

  await prisma.smsMessage.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      recipientPhone: user.phone,
      recipientName: user.name,
      recipientType: 'STAFF',
      messageContent: message,
      status: result.success ? 'SENT' : devFallback ? 'PENDING' : 'FAILED',
      africastalkingMessageId: result.providerMessageId,
      cost: result.cost,
      eventType,
      referenceId: otp.id,
      referenceType: 'SMS_OTP',
      failureReason: result.failureReason,
      sentAt: result.success ? new Date() : null,
    },
  });

  // A silent send failure would otherwise leave the user stuck entering a
  // code that was never delivered, with no way to know why.
  if (!result.success && !devFallback) {
    throw ApiError.badRequest('Could not send the verification code — please try again shortly', {
      reason: result.failureReason,
    });
  }

  return otp;
}

async function verifyOtp(userId, code) {
  const otp = await prisma.smsOtp.findFirst({
    where: { userId, code, isUsed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    throw ApiError.unauthorized('Invalid or expired verification code');
  }

  await prisma.smsOtp.update({ where: { id: otp.id }, data: { isUsed: true } });
}

export default { issueOtp, verifyOtp };
