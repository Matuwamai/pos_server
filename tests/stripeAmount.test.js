import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toStripeAmount, fromStripeAmount } from '../config/stripeAmount.js';

describe('stripeAmount', () => {
  test('a normal 2-decimal currency is multiplied by 100', () => {
    assert.equal(toStripeAmount(24.34, 'USD'), 2434);
    assert.equal(fromStripeAmount(2434, 'USD'), 24.34);
  });

  test('a true zero-decimal currency is sent as-is, matching this project\'s own decimalDigits', () => {
    assert.equal(toStripeAmount(2100, 'JPY'), 2100);
    assert.equal(fromStripeAmount(2100, 'JPY'), 2100);
  });

  // ISK and UGX are zero-decimal in this app's own rounding (config/currencies.js), but
  // Stripe's API still requires them encoded as if 2-decimal for backward compatibility
  // — docs.stripe.com/currencies gives the example of 5 ISK being sent as amount 500.
  test('ISK is encoded x100 despite being a zero-decimal currency for display/rounding', () => {
    assert.equal(toStripeAmount(5, 'ISK'), 500);
    assert.equal(fromStripeAmount(500, 'ISK'), 5);
  });

  test('UGX is encoded x100 despite being a zero-decimal currency for display/rounding', () => {
    assert.equal(toStripeAmount(1500, 'UGX'), 150000);
    assert.equal(fromStripeAmount(150000, 'UGX'), 1500);
  });
});
