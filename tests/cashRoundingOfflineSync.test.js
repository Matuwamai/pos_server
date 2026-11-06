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

// Mirrors services/order.js's createOrder being exercised directly over HTTP
// (tests/cashRoundingOrder.test.js) — this covers the *other* server-side path that
// also has to apply the identical cash-rounding logic: services/offlineSync.js's
// importOfflineOrder, which is what a desktop/mobile till's sync push actually goes
// through. Both paths must agree, or an offline-first till's own locally-computed
// rounded total would get rejected at sync time.
describe('cash rounding on offline-synced orders', () => {
  let owner, ownerId, locationId, variantId, device;

  before(async () => {
    const subdomain = `cash-rounding-sync-test-${randomUUID().slice(0, 8)}`;
    const signup = await call('POST', '/auth/signup', {
      body: {
        tenantName: 'Cash Rounding Sync Test',
        subdomain,
        currency: 'AUD',
        ownerName: 'Test Owner',
        ownerEmail: `owner-${subdomain}@example.com`,
        ownerPassword: 'TestPass123!',
      },
    });
    assert.equal(signup.status, 201, JSON.stringify(signup.body));
    owner = signup.body.token;
    ownerId = (await call('GET', '/users?limit=1', { token: owner })).body.data[0].id;
    locationId = (await call('GET', '/locations', { token: owner })).body.data[0].id;

    const product = await call('POST', '/products', {
      token: owner,
      body: { name: 'Sync Test Product', trackInventory: false, variants: [{ sku: `SYNC-${randomUUID().slice(0, 6)}`, price: 24.37 }] },
    });
    variantId = product.body.variants[0].id;

    const terminal = await call('POST', '/terminals', {
      token: owner,
      body: { locationId, name: 'Test Till', deviceIdentifier: `test-${randomUUID()}`, platform: 'desktop' },
    });
    const enrolled = await call('POST', `/terminals/${terminal.body.id}/enroll-device`, { token: owner });
    device = enrolled.body.token;
  });

  function saleFor(id, { total, payments }) {
    return {
      id,
      locationId,
      cashierId: ownerId,
      terminalReceiptNo: `T-SYNC-${id.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      items: [{ variantId, quantity: 1, unitPrice: 24.37, taxAmount: 0, lineTotal: 24.37, modifiers: [] }],
      discounts: [],
      payments,
      subtotal: 24.37,
      discountTotal: 0,
      taxTotal: 0,
      total,
    };
  }

  function push(ops) {
    return call('POST', '/sync/push', { token: device, body: { ops } });
  }

  test('a sale pre-rounded by the client to the AUD default is accepted', async () => {
    const id = randomUUID();
    const sale = saleFor(id, { total: 24.35, payments: [{ method: 'CASH', amount: 24.35 }] });

    const res = await push([{ opId: `sale-${id}`, type: 'order.create', payload: sale }]);
    assert.equal(res.body.results[0].status, 'CREATED', JSON.stringify(res.body.results[0]));

    const order = await call('GET', `/orders/${id}`, { token: owner });
    assert.equal(order.body.total, '24.35');
    assert.equal(order.body.cashRoundingAdjustment, '-0.02');
  });

  test('a sale submitting the exact (unrounded) total for a single cash payment is rejected', async () => {
    const id = randomUUID();
    const sale = saleFor(id, { total: 24.37, payments: [{ method: 'CASH', amount: 24.37 }] });

    const res = await push([{ opId: `sale-${id}`, type: 'order.create', payload: sale }]);
    assert.equal(res.body.results[0].status, 'REJECTED', JSON.stringify(res.body.results[0]));
    assert.match(res.body.results[0].result.error, /total does not match/i);
  });

  test('a split cash+card sale at the exact total is accepted — no rounding applied', async () => {
    const id = randomUUID();
    const sale = saleFor(id, {
      total: 24.37,
      payments: [
        { method: 'CASH', amount: 10 },
        { method: 'CARD', amount: 14.37, transactionRef: 'card-ref' },
      ],
    });

    const res = await push([{ opId: `sale-${id}`, type: 'order.create', payload: sale }]);
    assert.equal(res.body.results[0].status, 'CREATED', JSON.stringify(res.body.results[0]));

    const order = await call('GET', `/orders/${id}`, { token: owner });
    assert.equal(order.body.total, '24.37');
    assert.equal(order.body.cashRoundingAdjustment, '0');
  });
});
