// Canonical ISO 4217 currency list. This is the server's authoritative source for
// both rounding math (how many decimal places an amount actually has) and signup
// validation — desktop's CurrencyInfo table is manually kept in sync with this list
// (no shared codegen across the JS/C#/Dart codebases in this project).
//
// Deliberately excludes 3-decimal currencies (KWD, BHD, OMR, JOD, TND, LYD) — a
// handful of countries, and supporting them properly needs real per-currency
// decimal-digit awareness everywhere Decimal(10,2) is used today. Revisit only if a
// customer actually needs one of these.
const ZERO_DECIMAL_CODES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// {code, name} — decimalDigits is derived below (2 unless listed in
// ZERO_DECIMAL_CODES). Not exhaustive of every ISO 4217 code, but covers the
// currencies of the large majority of the world's economies.
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'ISK', name: 'Icelandic Krona' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'PYG', name: 'Paraguayan Guarani' },
  { code: 'UYU', name: 'Uruguayan Peso' },
  { code: 'CRC', name: 'Costa Rican Colon' },
  { code: 'GTQ', name: 'Guatemalan Quetzal' },
  { code: 'DOP', name: 'Dominican Peso' },
  { code: 'JMD', name: 'Jamaican Dollar' },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'TWD', name: 'Taiwan Dollar' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'PLN', name: 'Polish Zloty' },
];

const SUPPORTED_CURRENCIES = Object.freeze(
  // De-dupe (a couple of codes above are listed twice by accident of grouping) and
  // attach decimalDigits.
  [...new Map(CURRENCIES.map((c) => [c.code, c])).values()].map((c) => ({
    ...c,
    decimalDigits: ZERO_DECIMAL_CODES.has(c.code) ? 0 : 2,
  }))
);

const BY_CODE = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

function isSupportedCurrency(code) {
  return BY_CODE.has(code);
}

function getCurrencyDecimalDigits(code) {
  return BY_CODE.get(code)?.decimalDigits ?? 2;
}

export { SUPPORTED_CURRENCIES, isSupportedCurrency, getCurrencyDecimalDigits };
