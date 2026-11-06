// Cash-rounding units ("Swedish rounding") for currencies whose smallest coin has been
// withdrawn, so cash totals round to a denomination that still physically exists —
// card/digital payments stay exact. Sourced from central bank notices and independent
// POS/ERP vendor docs (see the cash-rounding plan doc for citations per currency).
// Deliberately excludes EUR and every other currency: cash rounding in a multi-country
// currency zone is a per-country rule (Finland/Belgium round, most of the Eurozone
// doesn't), and this app only models currency, not country — a currency-keyed default
// would be wrong for most EUR tenants. A tenant can still opt in/out of a custom unit
// regardless (Tenant.cashRoundingUnit), this table is only the starting default.
const DEFAULT_CASH_ROUNDING_UNIT = {
  AUD: 0.05,
  NZD: 0.1,
  CAD: 0.05,
  CHF: 0.05,
  SEK: 1,
  NOK: 1,
  DKK: 0.5,
};

function getDefaultCashRoundingUnit(currency) {
  return DEFAULT_CASH_ROUNDING_UNIT[currency] ?? 0;
}

// tenantOverride is Tenant.cashRoundingUnit: null means "use the currency default",
// any explicit number (including 0, meaning "disabled") takes precedence.
function getEffectiveCashRoundingUnit(currency, tenantOverride) {
  if (tenantOverride !== null && tenantOverride !== undefined) return Number(tenantOverride);
  return getDefaultCashRoundingUnit(currency);
}

export { DEFAULT_CASH_ROUNDING_UNIT, getDefaultCashRoundingUnit, getEffectiveCashRoundingUnit };
