import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import mpesaCredentialService from './mpesaCredential.js';
import mpesaDaraja from './mpesaDaraja.js';
const INTENT_LIFETIME_MS = 2 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 4000;
async function createIntent(tenantId, { amount, phoneNumber, terminalId, locationId, initiatedByUserId }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, currency: true, mpesaType: true, mpesaShortcode: true },
  });
  if (tenant.currency !== 'KES') throw ApiError.badRequest('M-Pesa is only available for businesses whose currency is KES');
  if (!tenant?.mpesaShortcode) throw ApiError.badRequest("This business hasn't set up a till/paybill number yet");

  const credential = await mpesaCredentialService.getDecryptedCredential(tenantId); // throws badRequest if absent

  const intent = await prisma.mpesaPaymentIntent.create({
    data: {
      amount,
      phoneNumber,
      terminalId: terminalId ?? null,
      locationId: locationId ?? null,
      initiatedByUserId: initiatedByUserId ?? null,
      expiresAt: new Date(Date.now() + INTENT_LIFETIME_MS),
    },
  });

  const callbackUrl = `${env.mpesa.callbackBaseUrl}/api/v1/webhooks/mpesa/stk-callback/${intent.id}`;
  const result = await mpesaDaraja.initiateStkPush({
    credential,
    shortcode: tenant.mpesaShortcode,
    shortcodeType: tenant.mpesaType,
    amount,
    phoneNumber,
    accountReference: tenant.name,
    transactionDesc: 'POS sale',
    callbackUrl,
  });

  if (!result.success) {
    await prisma.mpesaPaymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED', resultDesc: result.failureReason } });
    throw ApiError.badRequest(result.failureReason || 'Failed to send the M-Pesa prompt');
  }

  return prisma.mpesaPaymentIntent.update({
    where: { id: intent.id },
    data: { checkoutRequestId: result.checkoutRequestId, merchantRequestId: result.merchantRequestId },
  });
}

async function getIntentStatus(tenantId, intentId) {
  let intent = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) throw ApiError.notFound('Payment intent not found');

  const dueForLiveQuery = !intent.lastPolledAt || Date.now() - intent.lastPolledAt.getTime() >= MIN_POLL_INTERVAL_MS;

  if (intent.status === 'PENDING' && intent.checkoutRequestId) {
    if (intent.expiresAt < new Date()) {
      await finalizeIfPending(intentId, { status: 'TIMEOUT', resultDesc: 'The prompt was not answered in time' });
    } else if (dueForLiveQuery) {
      await prisma.mpesaPaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data: { lastPolledAt: new Date() } });

      const credential = await mpesaCredentialService.getDecryptedCredential(tenantId);
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { mpesaShortcode: true } });
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: tenant.mpesaShortcode, checkoutRequestId: intent.checkoutRequestId });

      if (result.outcome === 'SUCCESS') {
        await finalizeIfPending(intentId, { status: 'COMPLETED', resultCode: result.resultCode, resultDesc: result.resultDesc });
      } else if (result.outcome === 'CANCELLED') {
        await finalizeIfPending(intentId, { status: 'CANCELLED', resultCode: result.resultCode, resultDesc: result.resultDesc });
      } else if (result.outcome === 'FAILED') {
        await finalizeIfPending(intentId, { status: 'FAILED', resultCode: result.resultCode, resultDesc: result.resultDesc });
      }
     
    }
    intent = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intentId } });
  }

  return {
    id: intent.id,
    status: intent.status,
    resultDesc: intent.resultDesc,
    transactionRef: intent.mpesaReceiptNumber || intent.checkoutRequestId,
  };
}

async function finalizeIfPending(intentId, data) {
  await prisma.mpesaPaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data });
}


async function handleCallback(intentId, payload) {
  const intent = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return;

  const stkCallback = payload?.Body?.stkCallback;
  if (!stkCallback) return;

  const resultCode = Number(stkCallback.ResultCode);
  const metadata = Object.fromEntries((stkCallback.CallbackMetadata?.Item || []).map((item) => [item.Name, item.Value]));

  if (resultCode === 0) {
    await prisma.mpesaPaymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: { status: 'COMPLETED', resultCode, resultDesc: stkCallback.ResultDesc, mpesaReceiptNumber: metadata.MpesaReceiptNumber ?? null },
    });

    if (metadata.MpesaReceiptNumber) {
      await prisma.mpesaPaymentIntent.update({ where: { id: intentId }, data: { mpesaReceiptNumber: metadata.MpesaReceiptNumber } });
    }
  } else {
    const status = resultCode === 1032 ? 'CANCELLED' : 'FAILED';
    await prisma.mpesaPaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data: { status, resultCode, resultDesc: stkCallback.ResultDesc } });
  }
}

export default { createIntent, getIntentStatus, handleCallback };
