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
  const subdomain = `cash-rounding-test-${randomUUID().slice(0, 8)}`;
  const res = await call('POST', '/auth/signup', {
    body: {
      tenantName: `Cash Rounding Test ${currency}`,
      subdomain,
      currency,
      ownerName: 'Test Owner',
      ownerEmail: `owner-${subdomain}@example.com`,
      ownerPassword: 'TestPass123!',
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
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

describe('cash rounding on orders', () => {
  let aud;

  before(async () => {
    aud = await signUpTenant('AUD');
  });

  test('GET /tenant exposes the AUD default (0.05) with no override set', async () => {
    const tenant = await call('GET', '/tenant', { token: aud.token });
    assert.equal(tenant.body.cashRoundingUnitOverride, null);
    assert.equal(tenant.body.effectiveCashRoundingUnit, 0.05);
  });

  test('a single cash payment rounds the total to the nearest 5 cents and records the adjustment', async () => {
    const variantId = await createProduct(aud.token, { sku: `AUD-${randomUUID().slice(0, 6)}`, price: 24.37 });
    const res = await call('POST', '/orders', {
      token: aud.token,
      body: {
        locationId: aud.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 24.35 }],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.total, '24.35');
    assert.equal(res.body.cashRoundingAdjustment, '-0.02');

    const receipt = await fetch(`${BASE}/orders/${res.body.id}/receipt`, { headers: { Authorization: `Bearer ${aud.token}` } });
    const html = await receipt.text();
    assert.match(html, /Rounding/);
    assert.match(html, /-0\.02/);
  });

  test('a split cash+card payment is left exact — no rounding applied', async () => {
    const variantId = await createProduct(aud.token, { sku: `AUD-${randomUUID().slice(0, 6)}`, price: 24.37 });
    const res = await call('POST', '/orders', {
      token: aud.token,
      body: {
        locationId: aud.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [
          { method: 'CASH', amount: 10 },
          { method: 'CARD', amount: 14.37, transactionRef: 'card-ref' },
        ],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.total, '24.37');
    assert.equal(res.body.cashRoundingAdjustment, '0');
  });

  test('a tenant can override the default, including disabling it entirely', async () => {
    const override = await call('PATCH', '/tenant/cash-rounding', { token: aud.token, body: { cashRoundingUnit: 0 } });
    assert.equal(override.status, 200, JSON.stringify(override.body));
    assert.equal(override.body.cashRoundingUnitOverride, 0);
    assert.equal(override.body.effectiveCashRoundingUnit, 0);

    const variantId = await createProduct(aud.token, { sku: `AUD-${randomUUID().slice(0, 6)}`, price: 24.37 });
    const res = await call('POST', '/orders', {
      token: aud.token,
      body: {
        locationId: aud.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 24.37 }],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.total, '24.37');
    assert.equal(res.body.cashRoundingAdjustment, '0');

    // Clear the override back to the currency default.
    const cleared = await call('PATCH', '/tenant/cash-rounding', { token: aud.token, body: { cashRoundingUnit: null } });
    assert.equal(cleared.body.cashRoundingUnitOverride, null);
    assert.equal(cleared.body.effectiveCashRoundingUnit, 0.05);
  });

  test('a currency with no default (KES) is never rounded unless the tenant opts in', async () => {
    const kes = await signUpTenant('KES');
    const tenant = await call('GET', '/tenant', { token: kes.token });
    assert.equal(tenant.body.effectiveCashRoundingUnit, 0);

    const variantId = await createProduct(kes.token, { sku: `KES-${randomUUID().slice(0, 6)}`, price: 100.37 });
    const res = await call('POST', '/orders', {
      token: kes.token,
      body: {
        locationId: kes.locationId,
        items: [{ variantId, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 100.37 }],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.total, '100.37');
    assert.equal(res.body.cashRoundingAdjustment, '0');
  });
});
