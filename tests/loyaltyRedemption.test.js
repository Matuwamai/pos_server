// Integration tests for redeeming loyalty points as a checkout discount
// (Group B: loyalty points at checkout). Needs the same live test tenant as
// tests/sync.test.js / tests/orderRefund.test.js:
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

describe('loyalty point redemption at checkout', { skip }, () => {
  let owner, locationId, variantId, customerId, pointsPerCurrencyUnit, redemptionRate;

  async function balance() {
    return (await call('GET', `/loyalty-transactions/balance/${customerId}`, { token: owner })).body.balance;
  }

  before(async () => {
    const login = await call('POST', '/auth/login', {
      body: { subdomain: process.env.TEST_SUBDOMAIN, email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
    });
    assert.equal(login.status, 200, 'test login must succeed');
    owner = login.body.token;

    locationId = (await call('GET', '/locations', { token: owner })).body.data[0].id;
    const products = (await call('GET', '/products?limit=20', { token: owner })).body.data;
    const withStock = products.find((p) => p.trackInventory && p.variants.length > 0);
    assert.ok(withStock, 'the test tenant needs at least one tracked product');
    variantId = withStock.variants[0].id;

    customerId = (
      await call('POST', '/customers', { token: owner, body: { name: `Loyalty Test Customer ${randomUUID().slice(0, 6)}` } })
    ).body.id;

    // Earlier offline-sync tests against this shared tenant have already
    // sold this variant down to 0 — top it back up so the online sales
    // below (which, unlike offline sync, reject an oversell) can go through.
    await call('POST', '/inventory/adjustments', {
      token: owner,
      body: { variantId, locationId, changeQty: 1000, reason: 'loyalty redemption test restock' },
    });

    // Normalize the tenant's loyalty program to known, active rates — a
    // fresh tenant has none yet (POST creates it); a tenant reused across
    // test runs already has one (POST 409s, so PATCH it to the same state).
    const created = await call('POST', '/loyalty-program', { token: owner, body: { pointsPerCurrencyUnit: 1, redemptionRate: 0.01 } });
    if (created.status === 409) {
      await call('PATCH', '/loyalty-program', { token: owner, body: { pointsPerCurrencyUnit: 1, redemptionRate: 0.01, isActive: true } });
    }
    const program = (await call('GET', '/loyalty-program', { token: owner })).body;
    pointsPerCurrencyUnit = Number(program.pointsPerCurrencyUnit);
    redemptionRate = Number(program.redemptionRate);

    // Seed a starting balance the ordinary way: one plain cash sale with the
    // customer attached earns points automatically (services/order.js's
    // earnLoyaltyPoints), same as any other sale.
    const seedSale = await call('POST', '/orders', {
      token: owner,
      body: { locationId, customerId, items: [{ variantId, quantity: 10 }], payments: [{ method: 'CASH', amount: 1000 }] },
    });
    assert.equal(seedSale.status, 201, JSON.stringify(seedSale.body));
    assert.ok((await balance()) > 0, 'the seed sale must have earned at least one point to redeem below');
  });

  test('redeeming loyalty points discounts the order and nets against points earned on the same sale', async () => {
    const balanceBefore = await balance();
    const pointsToRedeem = Math.min(5, balanceBefore);

    const res = await call('POST', '/orders', {
      token: owner,
      body: {
        locationId,
        customerId,
        items: [{ variantId, quantity: 1 }],
        discounts: [{ loyaltyPointsRedeemed: pointsToRedeem }],
        payments: [{ method: 'CASH', amount: 1000 }],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const expectedDiscount = Math.round(pointsToRedeem * redemptionRate * 100) / 100;
    assert.equal(Number(res.body.discountTotal), expectedDiscount);
    assert.equal(res.body.discounts[0].promotionId, null);
    assert.equal(res.body.discounts[0].reason, `Redeemed ${pointsToRedeem} loyalty points`);

    // The same order also earns points on its own (post-discount) total —
    // existing, unrelated behavior this redemption doesn't special-case, so
    // the balance afterwards nets both ledger entries, not just the redeem.
    const pointsEarnedOnThisSale = Math.floor(Number(res.body.total) * pointsPerCurrencyUnit);
    assert.equal(await balance(), balanceBefore - pointsToRedeem + pointsEarnedOnThisSale);
  });

  test('redeeming more points than the balance is rejected, and the balance is unchanged', async () => {
    const balanceBefore = await balance();
    const res = await call('POST', '/orders', {
      token: owner,
      body: {
        locationId,
        customerId,
        items: [{ variantId, quantity: 1 }],
        discounts: [{ loyaltyPointsRedeemed: balanceBefore + 1000 }],
        payments: [{ method: 'CASH', amount: 1000 }],
      },
    });
    assert.equal(res.status, 409);
    assert.equal(await balance(), balanceBefore);
  });

  test('redeeming points with no customer attached to the order is rejected with 400', async () => {
    const res = await call('POST', '/orders', {
      token: owner,
      body: {
        locationId,
        items: [{ variantId, quantity: 1 }],
        discounts: [{ loyaltyPointsRedeemed: 1 }],
        payments: [{ method: 'CASH', amount: 1000 }],
      },
    });
    assert.equal(res.status, 400);
  });

  test('redeeming points while the program is inactive is rejected', async () => {
    await call('PATCH', '/loyalty-program', { token: owner, body: { isActive: false } });
    const res = await call('POST', '/orders', {
      token: owner,
      body: {
        locationId,
        customerId,
        items: [{ variantId, quantity: 1 }],
        discounts: [{ loyaltyPointsRedeemed: 1 }],
        payments: [{ method: 'CASH', amount: 1000 }],
      },
    });
    assert.equal(res.status, 409);
    // Restore — the program is shared, tenant-wide state that other runs
    // (and manual verification) rely on being active.
    await call('PATCH', '/loyalty-program', { token: owner, body: { isActive: true } });
  });
});
