// Stripe's own zero-decimal-currency list (docs.stripe.com/currencies) is NOT the same
// as this project's own (config/currencies.js) — most notably ISK and UGX are
// zero-decimal for our display/rounding purposes, but Stripe still requires them
// encoded as if 2-decimal (amount x100, decimal always "00") for backward compatibility.
// Keeping this mapping separate from getCurrencyDecimalDigits() avoids silently charging
// 1/100th of the intended amount for those two currencies.
const STRIPE_ZERO_DECIMAL_CODES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function toStripeAmount(amount, currencyCode) {
  const value = Number(amount);
  if (STRIPE_ZERO_DECIMAL_CODES.has(currencyCode)) return Math.round(value);
  return Math.round(value * 100);
}

function fromStripeAmount(stripeAmount, currencyCode) {
  if (STRIPE_ZERO_DECIMAL_CODES.has(currencyCode)) return Number(stripeAmount);
  return Number(stripeAmount) / 100;
}

export { toStripeAmount, fromStripeAmount };
