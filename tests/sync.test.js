// Integration tests for offline sync. They run against a live server and
// database, so they need a test tenant (owner account) to log in with:
//   TEST_SUBDOMAIN, TEST_EMAIL, TEST_PASSWORD  (optional TEST_BASE_URL)
// Without those they are skipped rather than failing.
//   TEST_SUBDOMAIN=... TEST_EMAIL=... TEST_PASSWORD=... npm test
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

describe('offline sync', { skip }, () => {
  let owner, ownerId, locationId, variant, device, terminalId, drawerId;

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
      body: { locationId, name: 'Test Till', deviceIdentifier: `test-${randomUUID()}`, platform: 'desktop' },
    });
    terminalId = terminal.body.id;
    const enrolled = await call('POST', `/terminals/${terminalId}/enroll-device`, { token: owner });
    device = enrolled.body.token;
  });

  function push(ops) {
    return call('POST', '/sync/push', { token: device, body: { ops } });
  }

  function saleFor(id, { total = 3.58, payments = [{ method: 'CASH', amount: 5 }], quantity = 1, lineTotal = 3.58 } = {}) {
    return {
      id,
      locationId,
      cashierId: ownerId,
      terminalReceiptNo: `T-TEST-${id.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      items: [{ variantId: variant.id, quantity, unitPrice: 3.25, taxAmount: 0.33, lineTotal, modifiers: [] }],
      discounts: [],
      payments,
      subtotal: 3.25 * quantity,
      discountTotal: 0,
      taxTotal: 0.33 * quantity,
      total,
    };
  }

  test('a device pull returns the catalog and roster without a locationId', async () => {
    const res = await call('GET', '/sync/pull?since=0', { token: device });
    assert.equal(res.status, 200);
    assert.ok(res.body.entities.products.length > 0);
    assert.ok(res.body.entities.users.length > 0);
    for (const user of res.body.entities.users) {
      assert.equal(user.passwordHash, undefined, 'password hashes must never be sent to a device');
    }
  });

  test('a PIN reaches the device only as a bcrypt hash', async () => {
    await call('PATCH', `/users/${ownerId}`, { token: owner, body: { pinCode: '4321' } });
    const res = await call('GET', '/sync/pull?since=0', { token: device });
    const me = res.body.entities.users.find((u) => u.id === ownerId);
    assert.ok(me.pinHash && me.pinHash.startsWith('$2'), 'PIN must be stored and sent as a bcrypt hash');
    assert.notEqual(me.pinHash, '4321');
    await call('PATCH', `/users/${ownerId}`, { token: owner, body: { pinCode: null } });
  });

  test('a drawer opened offline and a sale rung up on it are applied once', async () => {
    drawerId = randomUUID();
    const opened = await push([{ opId: `drawer-${drawerId}`, type: 'drawer.open', payload: { id: drawerId, locationId, cashierId: ownerId, openingFloat: 100, openedAt: new Date().toISOString() } }]);
    assert.equal(opened.body.results[0].status, 'CREATED');

    const saleId = randomUUID();
    const sale = { ...saleFor(saleId), cashDrawerSessionId: drawerId };
    const first = await push([{ opId: `sale-${saleId}`, type: 'order.create', payload: sale }]);
    assert.equal(first.body.results[0].status, 'CREATED');
    assert.equal(first.body.results[0].result.orderId, saleId);

    const replay = await push([{ opId: `sale-${saleId}`, type: 'order.create', payload: sale }]);
    assert.equal(replay.body.results[0].status, 'DUPLICATE', 'a retried upload must not create a second sale');

    const order = await call('GET', `/orders/${saleId}`, { token: owner });
    assert.equal(order.body.source, 'OFFLINE_SYNC');
    assert.equal(order.body.terminalReceiptNo, sale.terminalReceiptNo);
  });

  test('a sale whose total does not add up is rejected and the rejection is replayed', async () => {
    const id = randomUUID();
    const op = { opId: `bad-${id}`, type: 'order.create', payload: { ...saleFor(id), total: 99 } };
    const first = await push([op]);
    assert.equal(first.body.results[0].status, 'REJECTED');
    const again = await push([op]);
    assert.equal(again.body.results[0].status, 'REJECTED', 'a rejected op keeps its rejection on replay');
  });

  test('gift card tenders cannot be recorded offline', async () => {
    const id = randomUUID();
    const res = await push([{ opId: `gc-${id}`, type: 'order.create', payload: saleFor(id, { payments: [{ method: 'GIFT_CARD', amount: 5 }] }) }]);
    assert.equal(res.body.results[0].status, 'REJECTED');
  });

  test('an oversell is accepted with a warning and the stock is reversed afterwards', async () => {
    const id = randomUUID();
    const big = saleFor(id, { quantity: 100000, total: 357500, lineTotal: 357500, payments: [{ method: 'CASH', amount: 357500 }] });
    big.items[0] = { ...big.items[0], unitPrice: 3.25, taxAmount: 32500, lineTotal: 357500 };
    big.subtotal = 325000;
    big.taxTotal = 32500;
    const res = await push([{ opId: `over-${id}`, type: 'order.create', payload: big }]);
    assert.equal(res.body.results[0].status, 'CREATED');
    assert.ok(res.body.results[0].result.warnings.some((w) => w.startsWith('OVERSOLD')));

    const inv = (await call('GET', `/inventory?variantId=${variant.id}&locationId=${locationId}`, { token: owner })).body.data[0];
    const qty = Number(inv.quantity);
    if (qty < 0) {
      await call('POST', '/inventory/adjustments', {
        token: owner,
        body: { variantId: variant.id, locationId, changeQty: -qty, reason: 'test cleanup: reverse oversell from sync test' },
      });
    }
  });

  test('a revoked device is refused, and a fresh enrollment works again', async () => {
    await call('POST', `/terminals/${terminalId}/revoke-device`, { token: owner });
    assert.equal((await call('GET', '/sync/pull?since=0', { token: device })).status, 401);
    const again = await call('POST', `/terminals/${terminalId}/enroll-device`, { token: owner });
    assert.equal((await call('GET', '/sync/pull?since=0', { token: again.body.token })).status, 200);
  });

  test('a user token cannot push — only a device can', async () => {
    const res = await call('POST', '/sync/push', { token: owner, body: { ops: [{ opId: `u-${randomUUID()}`, type: 'drawer.open', payload: {} }] } });
    assert.ok(res.status === 401 || res.status === 403);
  });
});
