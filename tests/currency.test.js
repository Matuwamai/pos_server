// Integration tests for multi-currency support (Milestone 1): signup sets a
// tenant's currency once, order/invoice rounding respects that currency's
// decimal places, and M-Pesa is rejected for any non-KES tenant. Unlike the
// other live-tenant suites, these tests sign up their own fresh tenants via
// POST /auth/signup rather than depending on a pre-configured
// TEST_SUBDOMAIN/TEST_EMAIL/TEST_PASSWORD tenant — so they run whenever the
// server itself is reachable, no env vars required.
//
// Only two signups total (one JPY, one KES, shared across every test below
// via `before`) — POST /auth/signup is rate-limited per IP
// (middlewares/authRateLimit.js, 10/hour by default), so this suite stays
// well under that even run several times in the same hour.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000/api/v1';

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function signUpTenant(currency) {
  const subdomain = `currency-test-${randomUUID().slice(0, 8)}`;
  const res = await call('POST', '/auth/signup', {
    body: {
      tenantName: `Currency Test ${currency}`,
      subdomain,
      currency,
      ownerName: 'Test Owner',
      ownerEmail: `owner-${subdomain}@example.com`,
      ownerPassword: 'TestPass123!',
    },
  });
  assert.equal(res.status, 201, `signup with currency=${currency} must succeed: ${JSON.stringify(res.body)}`);
  const token = res.body.token;
  const locationId = (await call('GET', '/locations', { token })).body.data[0].id;
  return { token, locationId };
}

async function createProduct(token, { sku, price }) {
  const res = await call('POST', '/products', {
    token,
    body: { name: `Test product ${sku}`, trackInventory: false, variants: [{ sku, price }] },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.variants[0].id;
}

describe('multi-currency support', () => {
  let jpy, kes;

  before(async () => {
    jpy = await signUpTenant('JPY');
    kes = await signUpTenant('KES');
  });

  test('signup with an unsupported (3-decimal) currency is rejected', async () => {
    const res = await call('POST', '/auth/signup', {
      body: {
        tenantName: 'Should Not Exist',
        subdomain: `currency-test-${randomUUID().slice(0, 8)}`,
        currency: 'KWD',
        ownerName: 'Test Owner',
        ownerEmail: `owner-${randomUUID()}@example.com`,
        ownerPassword: 'TestPass123!',
      },
    });
    assert.equal(res.status, 422); // zod validation failure — see middlewares/validate.js
  });

  test('a JPY (0-decimal) tenant rounds order totals to whole units, and GET /tenant reflects the currency', async () => {
    const tenant = await call('GET', '/tenant', { token: jpy.token });
    assert.equal(tenant.body.currency, 'JPY');

    const variantId = await createProduct(jpy.token, { sku: `JPY-${randomUUID().slice(0, 6)}`, price: 1500 });
    const order = await call('POST', '/orders', {
      token: jpy.token,
      body: { locationId: jpy.locationId, items: [{ variantId, quantity: 1 }], payments: [{ method: 'CASH', amount: 1500 }] },
    });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal(order.body.currency, 'JPY');
    assert.equal(Number(order.body.subtotal), 1500);
    assert.equal(Number(order.body.total), 1500);
    assert.ok(!String(order.body.total).includes('.'), `expected a whole-unit total, got ${order.body.total}`);

    // The receipt endpoint returns HTML, not JSON — call() always JSON-parses,
    // so this one goes through fetch directly.
    const receiptRes = await fetch(`${BASE}/orders/${order.body.id}/receipt`, { headers: { Authorization: `Bearer ${jpy.token}` } });
    assert.equal(receiptRes.status, 200);
    const receiptHtml = await receiptRes.text();
    assert.ok(receiptHtml.includes('JPY'), 'the receipt should show the order currency code');
    assert.ok(!receiptHtml.includes('1500.0'), 'a 0-decimal currency should not render a fractional amount');
  });

  test('a KES tenant still rounds order totals to 2 decimal places', async () => {
    const variantId = await createProduct(kes.token, { sku: `KES-${randomUUID().slice(0, 6)}`, price: 150.5 });
    const order = await call('POST', '/orders', {
      token: kes.token,
      body: { locationId: kes.locationId, items: [{ variantId, quantity: 1 }], payments: [{ method: 'CASH', amount: 150.5 }] },
    });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal(order.body.currency, 'KES');
    assert.equal(Number(order.body.total), 150.5);
  });

  test('M-Pesa is rejected for a non-KES tenant, both as a payment method and as an STK prompt', async () => {
    const variantId = await createProduct(jpy.token, { sku: `MPESA-${randomUUID().slice(0, 6)}`, price: 1000 });

    const order = await call('POST', '/orders', {
      token: jpy.token,
      body: {
        locationId: jpy.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'MPESA', amount: 1000, transactionRef: 'ABC123' }],
      },
    });
    assert.equal(order.status, 400);

    const intent = await call('POST', '/payment-intents', { token: jpy.token, body: { amount: 1000, phoneNumber: '254712345678' } });
    assert.equal(intent.status, 400);

    // Configuring a shortcode at all is rejected too, not just using it.
    const settings = await call('PATCH', '/tenant/payments', { token: jpy.token, body: { mpesaType: 'TILL', mpesaShortcode: '174379' } });
    assert.equal(settings.status, 400);
  });

  test('an invoice for a JPY tenant rounds to whole units', async () => {
    const customer = await call('POST', '/customers', { token: jpy.token, body: { name: 'Invoice Currency Test' } });

    const invoice = await call('POST', '/invoices', {
      token: jpy.token,
      body: {
        customerId: customer.body.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ description: 'Consulting', quantity: 1, unitPrice: 2500 }],
      },
    });
    assert.equal(invoice.status, 201, JSON.stringify(invoice.body));
    assert.equal(invoice.body.currency, 'JPY');
    assert.equal(Number(invoice.body.total), 2500);
  });
});
