import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';
import smsProviderService from './smsProvider.js';

async function listSmsMessages({ recipientPhone, status, campaignId, page, limit }) {
  const where = {
    ...(recipientPhone ? { recipientPhone } : {}),
    ...(status ? { status } : {}),
    ...(campaignId ? { campaignId } : {}),
  };

  const [total, messages] = await prisma.$transaction([
    prisma.smsMessage.count({ where }),
    prisma.smsMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: messages, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getSmsMessageById(id) {
  const message = await prisma.smsMessage.findUnique({ where: { id } });
  if (!message) throw ApiError.notFound('SMS message not found');
  return message;
}

// One-off message to a customer/staff/supplier — not tied to a template or
// campaign, e.g. an ad-hoc note from a manager. Never throws on provider
// failure; the failure is recorded on the message row instead, exactly like
// smsOtp.js does for OTP sends, so callers can inspect status rather than
// having a UI action look like it crashed.
async function sendDirectSms(actingUser, { recipientPhone, recipientName, recipientType, message }) {
  const result = await smsProviderService.sendSms({ phone: recipientPhone, message });

  return prisma.smsMessage.create({
    data: {
      userId: actingUser.id,
      recipientPhone,
      recipientName,
      recipientType,
      messageContent: message,
      status: result.success ? 'SENT' : 'FAILED',
      africastalkingMessageId: result.providerMessageId,
      cost: result.cost,
      eventType: 'DIRECT_MESSAGE',
      failureReason: result.failureReason,
      sentAt: result.success ? new Date() : null,
    },
  });
}

export default { listSmsMessages, getSmsMessageById, sendDirectSms };
