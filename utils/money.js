function round(amount, decimalDigits) {
  const factor = 10 ** decimalDigits;
  return Math.round(amount * factor) / factor;
}

// Generalizes round() from "round to a power of ten" to "round to an arbitrary unit" —
// cash rounding (config/cashRounding.js) rounds to e.g. the nearest 0.05 or whole unit,
// not a decimal-place count. A falsy unit (0/null, "no rounding configured") is a
// no-op, same round-half-away-from-zero behavior as round() otherwise.
function roundToNearest(amount, unit) {
  if (!unit) return amount;
  // round(..., 2): every rounding unit this is actually called with (0.05, 0.10, 0.50,
  // 1 — see config/cashRounding.js) is exact to 2 decimals; without this, floating-
  // point multiplication can leave e.g. 24.400000000000002 instead of 24.4.
  return round(Math.round(amount / unit) * unit, 2);
}

export { round, roundToNearest };
