import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000/api/v1';

const Stripe = (await import('stripe')).default;
const encryption = (await import('../utils/encryption.js')).default;
const prisma = (await import('../config/prismaClient.js')).default;

const stripeStub = new Stripe('sk_test_fixture'); // only used for local, offline signature helpers below

async function call(method, path, { body, token, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function signUpTenant() {
  const subdomain = `stripe-test-${randomUUID().slice(0, 8)}`;
  const res = await call('POST', '/auth/signup', {
    body: {
      tenantName: 'Stripe Test',
      subdomain,
      currency: 'USD',
      ownerName: 'Test Owner',
      ownerEmail: `owner-${subdomain}@example.com`,
      ownerPassword: 'TestPass123!',
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const token = res.body.token;
  const tenantId = res.body.tenant.id;
  const locationId = (await call('GET', '/locations', { token })).body.data[0].id;
  return { token, tenantId, locationId };
}

async function createProduct(token, { sku, price }) {
  const res = await call('POST', '/products', {
    token,
    body: { name: `Test product ${sku}`, trackInventory: false, variants: [{ sku, price }] },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.variants[0].id;
}

// Seeds a StripeCredential row directly (bypassing services/stripeCredential.js's
// real webhookEndpoints.create() call, which needs network access) so the webhook
// route's signature check has a real secret to verify against.
async function seedCredential(tenantId, webhookSigningSecret) {
  await prisma.stripeCredential.create({
    data: {
      tenantId,
      secretKeyCipher: encryption.encrypt('sk_test_fixture'),
      webhookSigningSecretCipher: encryption.encrypt(webhookSigningSecret),
      webhookEndpointId: 'we_test_fixture',
    },
  });
}

async function seedIntent(tenantId, { checkoutSessionId, amount, consumedByOrderId = null }) {
  return prisma.stripePaymentIntent.create({
    data: {
      tenantId,
      checkoutSessionId,
      checkoutUrl: `https://checkout.stripe.com/c/pay/${checkoutSessionId}`,
      amount,
      currency: 'USD',
      consumedByOrderId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

function checkoutCompletedPayload(checkoutSessionId) {
  return JSON.stringify({
    id: 'evt_test',
    type: 'checkout.session.completed',
    data: { object: { id: checkoutSessionId, payment_status: 'paid' } },
  });
}

describe('Stripe webhook signature verification', () => {
  let tenant;
  let webhookSigningSecret;

  before(async () => {
    tenant = await signUpTenant();
    webhookSigningSecret = `whsec_test_${randomUUID()}`;
    await seedCredential(tenant.tenantId, webhookSigningSecret);
  });

  test('a validly-signed checkout.session.completed event completes the matching intent', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 24.34 });
    const payload = checkoutCompletedPayload(intent.checkoutSessionId);
    const signature = stripeStub.webhooks.generateTestHeaderString({ payload, secret: webhookSigningSecret });

    const res = await fetch(`${BASE}/webhooks/stripe/${tenant.tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      body: payload,
    });
    assert.equal(res.status, 200);

    const updated = await prisma.stripePaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(updated.status, 'COMPLETED');
  });

  test('a tampered signature is rejected and the intent is left PENDING', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 10 });
    const payload = checkoutCompletedPayload(intent.checkoutSessionId);
    const validSignature = stripeStub.webhooks.generateTestHeaderString({ payload, secret: webhookSigningSecret });
    const tamperedSignature = validSignature.replace(/v1=([a-f0-9])/, (_, c) => `v1=${c === 'a' ? 'b' : 'a'}`);

    const res = await fetch(`${BASE}/webhooks/stripe/${tenant.tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': tamperedSignature },
      body: payload,
    });
    assert.equal(res.status, 400);

    const unchanged = await prisma.stripePaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(unchanged.status, 'PENDING');
  });

  test('replaying an already-completed event is a no-op, not an error', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 5 });
    const payload = checkoutCompletedPayload(intent.checkoutSessionId);
    const signature = stripeStub.webhooks.generateTestHeaderString({ payload, secret: webhookSigningSecret });
    const headers = { 'Content-Type': 'application/json', 'Stripe-Signature': signature };

    const first = await fetch(`${BASE}/webhooks/stripe/${tenant.tenantId}`, { method: 'POST', headers, body: payload });
    assert.equal(first.status, 200);
    const second = await fetch(`${BASE}/webhooks/stripe/${tenant.tenantId}`, { method: 'POST', headers, body: payload });
    assert.equal(second.status, 200);

    const final = await prisma.stripePaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(final.status, 'COMPLETED');
  });
});

describe('STRIPE payments on an order', () => {
  let tenant, variantId;

  before(async () => {
    tenant = await signUpTenant();
    variantId = await createProduct(tenant.token, { sku: `STRIPE-${randomUUID().slice(0, 6)}`, price: 24.34 });
  });

  test('a completed, unconsumed intent with a matching amount is accepted', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 24.34 });
    await prisma.stripePaymentIntent.update({ where: { id: intent.id }, data: { status: 'COMPLETED' } });

    const res = await call('POST', '/orders', {
      token: tenant.token,
      body: {
        locationId: tenant.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'STRIPE', amount: 24.34, transactionRef: intent.id }],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const consumed = await prisma.stripePaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(consumed.consumedByOrderId, res.body.id);
  });

  test('an intent that has not completed yet is rejected', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 24.34 });

    const res = await call('POST', '/orders', {
      token: tenant.token,
      body: {
        locationId: tenant.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'STRIPE', amount: 24.34, transactionRef: intent.id }],
      },
    });
    assert.equal(res.status, 400);
  });

  test('a completed intent whose amount does not match the payment is rejected', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 24.34 });
    await prisma.stripePaymentIntent.update({ where: { id: intent.id }, data: { status: 'COMPLETED' } });

    const res = await call('POST', '/orders', {
      token: tenant.token,
      body: {
        locationId: tenant.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'STRIPE', amount: 1, transactionRef: intent.id }],
      },
    });
    assert.equal(res.status, 400);
  });

  test('a completed intent that was already applied to another order cannot be reused', async () => {
    const intent = await seedIntent(tenant.tenantId, { checkoutSessionId: `cs_test_${randomUUID()}`, amount: 24.34 });
    await prisma.stripePaymentIntent.update({
      where: { id: intent.id },
      data: { status: 'COMPLETED', consumedByOrderId: randomUUID() },
    });

    const res = await call('POST', '/orders', {
      token: tenant.token,
      body: {
        locationId: tenant.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'STRIPE', amount: 24.34, transactionRef: intent.id }],
      },
    });
    assert.equal(res.status, 409);
  });
});

after(async () => {
  await prisma.$disconnect();
});
