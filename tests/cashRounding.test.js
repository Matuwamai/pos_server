import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { roundToNearest } from '../utils/money.js';
import { getDefaultCashRoundingUnit, getEffectiveCashRoundingUnit } from '../config/cashRounding.js';

describe('roundToNearest', () => {
  test('a falsy unit is a no-op', () => {
    assert.equal(roundToNearest(24.37, 0), 24.37);
    assert.equal(roundToNearest(24.37, null), 24.37);
  });

  test('rounds to the nearest 0.05 (AUD/CAD/CHF)', () => {
    assert.equal(roundToNearest(24.37, 0.05), 24.35);
    assert.equal(roundToNearest(24.38, 0.05), 24.4);
    assert.equal(roundToNearest(24.32, 0.05), 24.3);
    assert.equal(roundToNearest(24.33, 0.05), 24.35); // midpoint rounds up
  });

  test('rounds to the nearest 0.10 (NZD)', () => {
    assert.equal(roundToNearest(24.34, 0.1), 24.3);
    assert.equal(roundToNearest(24.35, 0.1), 24.4); // midpoint rounds up
  });

  // Denmark's own stated rule: øre 1-24 round down, 25-49 round up — exactly
  // round-half-up at the 0.50 unit, no special-casing needed.
  test('rounds to the nearest 0.50 (DKK)', () => {
    assert.equal(roundToNearest(23.24, 0.5), 23);
    assert.equal(roundToNearest(23.25, 0.5), 23.5);
    assert.equal(roundToNearest(23.49, 0.5), 23.5);
    assert.equal(roundToNearest(23.74, 0.5), 23.5);
    assert.equal(roundToNearest(23.75, 0.5), 24);
  });

  test('rounds to the nearest whole unit (SEK/NOK)', () => {
    assert.equal(roundToNearest(24.49, 1), 24);
    assert.equal(roundToNearest(24.5, 1), 25);
  });
});

describe('getDefaultCashRoundingUnit / getEffectiveCashRoundingUnit', () => {
  test('known currencies have their legally-documented default', () => {
    assert.equal(getDefaultCashRoundingUnit('AUD'), 0.05);
    assert.equal(getDefaultCashRoundingUnit('NZD'), 0.1);
    assert.equal(getDefaultCashRoundingUnit('CAD'), 0.05);
    assert.equal(getDefaultCashRoundingUnit('CHF'), 0.05);
    assert.equal(getDefaultCashRoundingUnit('SEK'), 1);
    assert.equal(getDefaultCashRoundingUnit('NOK'), 1);
    assert.equal(getDefaultCashRoundingUnit('DKK'), 0.5);
  });

  test('EUR and every other currency default to no rounding — cash rounding in a multi-country currency zone is a per-country rule this app has no way to apply correctly', () => {
    assert.equal(getDefaultCashRoundingUnit('EUR'), 0);
    assert.equal(getDefaultCashRoundingUnit('USD'), 0);
    assert.equal(getDefaultCashRoundingUnit('KES'), 0);
  });

  test('a tenant override (including 0, "disabled") always wins over the currency default', () => {
    assert.equal(getEffectiveCashRoundingUnit('AUD', null), 0.05);
    assert.equal(getEffectiveCashRoundingUnit('AUD', 0), 0);
    assert.equal(getEffectiveCashRoundingUnit('AUD', 0.1), 0.1);
    assert.equal(getEffectiveCashRoundingUnit('USD', 0.05), 0.05);
  });
});
