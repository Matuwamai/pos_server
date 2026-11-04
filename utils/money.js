// The one rounding primitive every money-handling service imports, instead of each
// reimplementing its own hardcoded-to-2-decimals `round2`. `decimalDigits` comes from
// config/currencies.js's getCurrencyDecimalDigits(tenant.currency) — 0 for currencies
// like JPY/KRW/VND, 2 for the large majority (USD, EUR, KES, …).
function round(amount, decimalDigits) {
  const factor = 10 ** decimalDigits;
  return Math.round(amount * factor) / factor;
}

export { round };
