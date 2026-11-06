import QRCode from 'qrcode';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import stripeCredentialService from './stripeCredential.js';
import buildStripeClient from '../utils/stripeClient.js';
import { toStripeAmount } from '../config/stripeAmount.js';

// Longer than M-Pesa's 2-minute STK push window (services/mpesaPaymentIntent.js) — the
// customer has to scan a QR with a separate device, open the page, and enter card
// details, which takes longer than confirming a prompt that's already on their phone.
const INTENT_LIFETIME_MS = 10 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 4000;

async function withQrCode(intent) {
  if (!intent.checkoutUrl) return { id: intent.id, status: intent.status };
  const qrCodeDataUrl = await QRCode.toDataURL(intent.checkoutUrl);
  return {
    id: intent.id,
    status: intent.status,
    checkoutUrl: intent.checkoutUrl,
    qrCodeDataUrl,
    transactionRef: intent.status === 'COMPLETED' ? intent.id : null,
  };
}

async function createIntent(tenantId, { amount, terminalId, locationId, initiatedByUserId }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
  const { secretKey } = await stripeCredentialService.getDecryptedCredential(tenantId); // throws badRequest if absent
  const stripe = buildStripeClient(secretKey);

  const intent = await prisma.stripePaymentIntent.create({
    data: {
      tenantId,
      amount,
      currency: tenant.currency,
      terminalId: terminalId ?? null,
      locationId: locationId ?? null,
      initiatedByUserId: initiatedByUserId ?? null,
      expiresAt: new Date(Date.now() + INTENT_LIFETIME_MS),
    },
  });

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: intent.id,
      line_items: [
        {
          price_data: {
            currency: tenant.currency.toLowerCase(),
            unit_amount: toStripeAmount(amount, tenant.currency),
            product_data: { name: 'POS sale' },
          },
          quantity: 1,
        },
      ],
      success_url: `${env.appUrl}/pay/stripe/complete`,
      cancel_url: `${env.appUrl}/pay/stripe/cancel`,
    });
  } catch (err) {
    await prisma.stripePaymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
    throw ApiError.badRequest(`Could not create a Stripe checkout session: ${err.message}`);
  }

  const updated = await prisma.stripePaymentIntent.update({
    where: { id: intent.id },
    data: { checkoutSessionId: session.id, checkoutUrl: session.url },
  });

  return withQrCode(updated);
}

async function finalizeIfPending(checkoutSessionId, data) {
  await prisma.stripePaymentIntent.updateMany({ where: { checkoutSessionId, status: 'PENDING' }, data });
}

async function getIntentStatus(tenantId, intentId) {
  let intent = await prisma.stripePaymentIntent.findFirst({ where: { id: intentId, tenantId } });
  if (!intent) throw ApiError.notFound('Payment intent not found');

  const dueForLiveQuery = !intent.lastPolledAt || Date.now() - intent.lastPolledAt.getTime() >= MIN_POLL_INTERVAL_MS;

  if (intent.status === 'PENDING' && intent.checkoutSessionId) {
    if (intent.expiresAt < new Date()) {
      await finalizeIfPending(intent.checkoutSessionId, { status: 'TIMEOUT' });
    } else if (dueForLiveQuery) {
      await prisma.stripePaymentIntent.updateMany({ where: { id: intentId, status: 'PENDING' }, data: { lastPolledAt: new Date() } });

      const { secretKey } = await stripeCredentialService.getDecryptedCredential(tenantId);
      const stripe = buildStripeClient(secretKey);
      const session = await stripe.checkout.sessions.retrieve(intent.checkoutSessionId);

      if (session.payment_status === 'paid') {
        await finalizeIfPending(intent.checkoutSessionId, { status: 'COMPLETED' });
      } else if (session.status === 'expired') {
        await finalizeIfPending(intent.checkoutSessionId, { status: 'TIMEOUT' });
      }
    }
    intent = await prisma.stripePaymentIntent.findUnique({ where: { id: intentId } });
  }

  return withQrCode(intent);
}

// The tenant-wide webhook endpoint (routers/stripeWebhook.js) receives every checkout
// session event for this tenant's Stripe account, so the matching intent is resolved by
// checkoutSessionId, not by anything in the URL (unlike M-Pesa's per-intent callback URL
// — Stripe's webhook is registered once per tenant, not once per payment attempt).
async function handleWebhookEvent(tenantId, rawBody, signatureHeader) {
  const { secretKey, webhookSigningSecret } = await stripeCredentialService.getDecryptedCredential(tenantId);
  const stripe = buildStripeClient(secretKey);

  const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSigningSecret); // throws on a bad signature

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await finalizeIfPending(session.id, { status: 'COMPLETED' });
    }
  }
}

export default { createIntent, getIntentStatus, handleWebhookEvent };
