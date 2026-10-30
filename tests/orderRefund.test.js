// Integration tests for refunding an order from a device (terminal) token —
// Phase 5's desktop refund feature. Needs the same test tenant as
// tests/sync.test.js:
//   TEST_SUBDOMAIN, TEST_EMAIL, TEST_PASSWORD  (optional TEST_BASE_URL)
// Without those they are skipped rather than failing.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000/api/v1';
const CONFIGURED = Boolean(process.env.TEST_SUBDOMAIN && process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
const skip = CONFIGURED ? false : 'set TEST_SUBDOMAIN, TEST_EMAIL and TEST_PASSWORD to run';

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

describe('order refund from a device token', { skip }, () => {
  let owner, ownerId, locationId, variant, device, terminalId, orderId, orderItemId;

  before(async () => {
    const login = await call('POST', '/auth/login', {
      body: { subdomain: process.env.TEST_SUBDOMAIN, email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
    });
    assert.equal(login.status, 200, 'test login must succeed');
    owner = login.body.token;
    ownerId = login.body.user.id;

    locationId = (await call('GET', '/locations', { token: owner })).body.data[0].id;
    const products = (await call('GET', '/products?limit=20', { token: owner })).body.data;
    const withStock = products.find((p) => p.trackInventory && p.variants.length > 0);
    assert.ok(withStock, 'the test tenant needs at least one tracked product');
    variant = withStock.variants[0];

    const terminal = await call('POST', '/terminals', {
      token: owner,
      body: { locationId, name: 'Refund Test Till', deviceIdentifier: `test-refund-${randomUUID()}`, platform: 'desktop' },
    });
    terminalId = terminal.body.id;
    const enrolled = await call('POST', `/terminals/${terminalId}/enroll-device`, { token: owner });
    device = enrolled.body.token;

    // A sale to refund, pushed the same way the till itself would.
    const saleId = randomUUID();
    const sale = {
      id: saleId,
      locationId,
      cashierId: ownerId,
      terminalReceiptNo: `T-REFUND-TEST-${saleId.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      items: [{ variantId: variant.id, quantity: 1, unitPrice: 3.25, taxAmount: 0, lineTotal: 3.25, modifiers: [] }],
      discounts: [],
      payments: [{ method: 'CASH', amount: 3.25 }],
      subtotal: 3.25,
      discountTotal: 0,
      taxTotal: 0,
      total: 3.25,
    };
    const pushed = await call('POST', '/sync/push', { token: device, body: { ops: [{ opId: `refund-test-sale-${saleId}`, type: 'order.create', payload: sale }] } });
    assert.equal(pushed.body.results[0].status, 'CREATED');
    orderId = saleId;

    const order = await call('GET', `/orders/${orderId}`, { token: owner });
    orderItemId = order.body.items[0].id;
  });

  test('a device token can search and read orders, but still cannot create one online', async () => {
    const search = await call('GET', `/orders?search=${orderId}`, { token: device });
    assert.equal(search.status, 200);

    const read = await call('GET', `/orders/${orderId}`, { token: device });
    assert.equal(read.status, 200);

    const create = await call('POST', '/orders', { token: device, body: {} });
    assert.equal(create.status, 403, "a till's own sales must only ever reach the server via sync/push, never this route");
  });

  test('refunding without processedByUserId is rejected with 400, not a 500 crash', async () => {
    const res = await call('POST', `/orders/${orderId}/refund`, {
      token: device,
      body: { items: [{ orderItemId, quantity: 1, amount: 3.25 }], refundMethod: 'CASH' },
    });
    assert.equal(res.status, 400);
  });

  test('refunding with a nonexistent processedByUserId is rejected with 400', async () => {
    const res = await call('POST', `/orders/${orderId}/refund`, {
      token: device,
      body: { items: [{ orderItemId, quantity: 1, amount: 3.25 }], refundMethod: 'CASH', processedByUserId: randomUUID() },
    });
    assert.equal(res.status, 400);
  });

  test('a device token can refund an order on behalf of the signed-in cashier', async () => {
    const res = await call('POST', `/orders/${orderId}/refund`, {
      token: device,
      body: { items: [{ orderItemId, quantity: 1, amount: 3.25 }], reason: 'test refund', refundMethod: 'CASH', processedByUserId: ownerId },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'REFUNDED');
    assert.equal(res.body.refunds[0].processedByUserId, ownerId);
    assert.ok(res.body.payments.some((p) => Number(p.amount) === -3.25));
  });

  test('a revoked device cannot refund', async () => {
    await call('POST', `/terminals/${terminalId}/revoke-device`, { token: owner });
    const res = await call('POST', `/orders/${orderId}/refund`, {
      token: device,
      body: { items: [{ orderItemId, quantity: 1, amount: 3.25 }], refundMethod: 'CASH', processedByUserId: ownerId },
    });
    assert.equal(res.status, 401);
  });
});
