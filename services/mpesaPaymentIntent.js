import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import mpesaCredentialService from './mpesaCredential.js';
import mpesaDaraja from './mpesaDaraja.js';

// Daraja prompts expire on their own well under this; it's a backstop so a
// prompt the customer never answers doesn't poll PENDING forever.
const INTENT_LIFETIME_MS = 2 * 60 * 1000;

// Safaricom's stkpushquery enforces a tight rate limit (observed live
// against the sandbox: a burst of ~3 requests/minute) — this throttles the
// live query independently of how fast a client polls GET
// /payment-intents/:id, so a 2-3s client poll interval doesn't get the
// whole endpoint 429'd by Daraja.
const MIN_POLL_INTERVAL_MS = 4000;

// A payment intent is a pre-step, never itself the record of a sale: it
// resolves to a transactionRef (the real M-Pesa receipt once the webhook
// lands, or the checkoutRequestId as an immediate fallback) that the client
// then submits to the existing, untouched POST /orders exactly as manual
// M-Pesa entry already does. createOrder never needs to know STK push exists.
async function createIntent(tenantId, { amount, phoneNumber, terminalId, locationId, initiatedByUserId }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, mpesaType: true, mpesaShortcode: true } });
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

// The status endpoint IS the confirmation path: while still PENDING, it
// actively queries Daraja's stkpushquery API rather than waiting on the
// webhook, so the client can "poll until done" with no dependency on an
// inbound callback ever reaching this server (useful in dev with no public
// tunnel, and robust in production if the callback is ever dropped/delayed).
// stkpushquery never returns the receipt number — only whether payment
// succeeded — so `transactionRef` falls back to checkoutRequestId until the
// webhook backfills the real receipt (see handleCallback below).
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
      // PENDING outcome: nothing more to write.
    }
    // Re-read regardless of which branch ran, in case the webhook landed
    // moments ago and already resolved this for free.
    intent = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intentId } });
  }

  return {
    id: intent.id,
    status: intent.status,
    resultDesc: intent.resultDesc,
    transactionRef: intent.mpesaReceiptNumber || intent.checkoutRequestId,
  };
}

// Only applies while still PENDING, so whichever of {this poll, a landing
// webhook} resolves the intent first wins — the other can't clobber it.
async function finalizeIfPending(intentId, data) {
  await prisma.mpesaPaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data });
}

// Called with no tenant context (no JWT on an inbound webhook) — looked up
// by the unguessable intent id alone, same reasoning as
// controllers/billing.js's webhook. Always resolves without throwing: an
// unknown/malformed callback is logged and dropped, never retried, since a
// retry wouldn't fix either case.
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
    // Backfill the real receipt even if polling already resolved this intent
    // (via the checkoutRequestId fallback) before the callback arrived —
    // this is the one field polling alone can never learn.
    if (metadata.MpesaReceiptNumber) {
      await prisma.mpesaPaymentIntent.update({ where: { id: intentId }, data: { mpesaReceiptNumber: metadata.MpesaReceiptNumber } });
    }
  } else {
    const status = resultCode === 1032 ? 'CANCELLED' : 'FAILED';
    await prisma.mpesaPaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data: { status, resultCode, resultDesc: stkCallback.ResultDesc } });
  }
}

export default { createIntent, getIntentStatus, handleCallback };
