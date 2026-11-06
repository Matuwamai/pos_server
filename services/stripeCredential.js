import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import encryption from '../utils/encryption.js';
import buildStripeClient from '../utils/stripeClient.js';

function webhookUrlFor(tenantId) {
  return `${env.stripe.webhookBaseUrl}/api/v1/webhooks/stripe/${tenantId}`;
}

async function upsertCredential(tenantId, secretKey) {
  if (!env.stripe.webhookBaseUrl) {
    throw ApiError.badRequest('Stripe is not configured on this server (missing STRIPE_WEBHOOK_BASE_URL)');
  }

  // Register the new endpoint before touching anything existing — if the new key is bad
  // this throws here and the tenant's current (working) credential is left untouched.
  let endpoint;
  try {
    const stripe = buildStripeClient(secretKey);
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrlFor(tenantId),
      enabled_events: ['checkout.session.completed'],
    });
  } catch (err) {
    throw ApiError.badRequest(`Could not connect to Stripe with that key: ${err.message}`);
  }

  const existing = await prisma.stripeCredential.findUnique({ where: { tenantId } });
  if (existing) {
    try {
      const oldStripe = buildStripeClient(encryption.decrypt(existing.secretKeyCipher));
      await oldStripe.webhookEndpoints.del(existing.webhookEndpointId);
    } catch {
      // Best-effort cleanup — the old key may already be rotated/revoked on Stripe's side.
    }
  }

  const data = {
    secretKeyCipher: encryption.encrypt(secretKey),
    webhookSigningSecretCipher: encryption.encrypt(endpoint.secret),
    webhookEndpointId: endpoint.id,
  };
  await prisma.stripeCredential.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
}

async function removeCredential(tenantId) {
  const existing = await prisma.stripeCredential.findUnique({ where: { tenantId } });
  if (!existing) return;

  try {
    const stripe = buildStripeClient(encryption.decrypt(existing.secretKeyCipher));
    await stripe.webhookEndpoints.del(existing.webhookEndpointId);
  } catch {
    // Best-effort cleanup — the key may already be rotated/revoked on Stripe's side.
  }

  await prisma.stripeCredential.deleteMany({ where: { tenantId } });
}

async function getDecryptedCredential(tenantId) {
  const row = await prisma.stripeCredential.findUnique({ where: { tenantId } });
  if (!row) throw ApiError.badRequest("Stripe isn't set up for this business yet");
  return {
    secretKey: encryption.decrypt(row.secretKeyCipher),
    webhookSigningSecret: encryption.decrypt(row.webhookSigningSecretCipher),
  };
}

export default { upsertCredential, removeCredential, getDecryptedCredential };
