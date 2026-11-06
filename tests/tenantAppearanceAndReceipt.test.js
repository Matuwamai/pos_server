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

async function signUpTenant() {
  const subdomain = `appearance-test-${randomUUID().slice(0, 8)}`;
  const res = await call('POST', '/auth/signup', {
    body: {
      tenantName: 'Appearance Test',
      subdomain,
      currency: 'USD',
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

async function ringUpOrder(token, locationId, variantId, amount) {
  const res = await call('POST', '/orders', {
    token,
    body: {
      locationId,
      items: [{ variantId, quantity: 1 }],
      payments: [{ method: 'CASH', amount }],
      customerId: undefined,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
}

describe('tenant appearance settings', () => {
  let tenant;

  before(async () => {
    tenant = await signUpTenant();
  });

  test('GET /tenant defaults to no theme color override and all receipt flags on', async () => {
    const res = await call('GET', '/tenant', { token: tenant.token });
    assert.equal(res.body.themeColor, null);
    assert.equal(res.body.receiptFooterMessage, null);
    assert.equal(res.body.receiptShowCustomerName, true);
    assert.equal(res.body.receiptShowCashierName, true);
    assert.equal(res.body.receiptShowLogo, true);
  });

  test('a valid hex color is accepted and persisted', async () => {
    const res = await call('PATCH', '/tenant/appearance', { token: tenant.token, body: { themeColor: '#ff6600' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.themeColor, '#ff6600');
  });

  test('an invalid hex color is rejected', async () => {
    const res = await call('PATCH', '/tenant/appearance', { token: tenant.token, body: { themeColor: 'orange' } });
    assert.equal(res.status, 422);
  });

  test('null clears the theme color override back to the default', async () => {
    const res = await call('PATCH', '/tenant/appearance', { token: tenant.token, body: { themeColor: null } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.themeColor, null);
  });

  test('receipt settings can be customized and read back', async () => {
    const res = await call('PATCH', '/tenant/receipt-settings', {
      token: tenant.token,
      body: {
        receiptFooterMessage: 'Come again soon!',
        receiptShowCustomerName: false,
        receiptShowCashierName: false,
        receiptShowLogo: false,
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.receiptFooterMessage, 'Come again soon!');
    assert.equal(res.body.receiptShowCustomerName, false);
    assert.equal(res.body.receiptShowCashierName, false);
    assert.equal(res.body.receiptShowLogo, false);
  });

  test('a footer message over 200 characters is rejected', async () => {
    const res = await call('PATCH', '/tenant/receipt-settings', {
      token: tenant.token,
      body: { receiptFooterMessage: 'x'.repeat(201) },
    });
    assert.equal(res.status, 422);
  });
});

describe('receipt HTML reflects appearance/receipt settings', () => {
  let tenant, variantId;

  before(async () => {
    tenant = await signUpTenant();
    variantId = await createProduct(tenant.token, { sku: `RCPT-${randomUUID().slice(0, 6)}`, price: 12 });
  });

  test('defaults: hardcoded footer, customer/cashier lines shown', async () => {
    const orderId = await ringUpOrder(tenant.token, tenant.locationId, variantId, 12);
    const res = await fetch(`${BASE}/orders/${orderId}/receipt`, { headers: { Authorization: `Bearer ${tenant.token}` } });
    const html = await res.text();
    assert.match(html, /Thank you for your business!/);
    assert.match(html, /Served by/);
    assert.match(html, /color: #0f766e/); // the default accent, used when themeColor is unset
  });

  test('a custom theme color and footer message are reflected, and hidden fields are omitted', async () => {
    await call('PATCH', '/tenant/appearance', { token: tenant.token, body: { themeColor: '#aa00ff' } });
    await call('PATCH', '/tenant/receipt-settings', {
      token: tenant.token,
      body: { receiptFooterMessage: 'See you next time!', receiptShowCashierName: false },
    });

    const orderId = await ringUpOrder(tenant.token, tenant.locationId, variantId, 12);
    const res = await fetch(`${BASE}/orders/${orderId}/receipt`, { headers: { Authorization: `Bearer ${tenant.token}` } });
    const html = await res.text();
    assert.match(html, /color: #aa00ff/);
    assert.match(html, /See you next time!/);
    assert.doesNotMatch(html, /Thank you for your business!/);
    assert.doesNotMatch(html, /Served by/);
  });

  test('a footer message containing HTML is escaped, not rendered', async () => {
    await call('PATCH', '/tenant/receipt-settings', {
      token: tenant.token,
      body: { receiptFooterMessage: '<script>alert(1)</script>' },
    });
    const orderId = await ringUpOrder(tenant.token, tenant.locationId, variantId, 12);
    const res = await fetch(`${BASE}/orders/${orderId}/receipt`, { headers: { Authorization: `Bearer ${tenant.token}` } });
    const html = await res.text();
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
  });
});
