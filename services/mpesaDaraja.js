import logger from '../config/logger.js';

const BASE_URLS = {
  SANDBOX: 'https://sandbox.safaricom.co.ke',
  PRODUCTION: 'https://api.safaricom.co.ke',
};

// Daraja OAuth tokens last ~3600s. Cached in-memory per tenant+environment
// so concurrent requests don't each mint a fresh one — lost on restart,
// which just costs the next call one extra round trip.
const tokenCache = new Map();

async function getAccessToken({ consumerKey, consumerSecret, environment }) {
  const cacheKey = `${environment}:${consumerKey}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await fetch(`${BASE_URLS[environment]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.errorMessage || `Daraja OAuth failed (HTTP ${response.status})`);
  }

  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  // Refreshed a minute early so a request never races an about-to-expire token.
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + expiresInMs - 60_000 });
  return data.access_token;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function buildPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

// Never throws — a failed/unreachable Daraja call is a normal, expected
// outcome the caller records on the MpesaPaymentIntent, same never-throw
// convention as services/smsProvider.js.
async function initiateStkPush({ credential, shortcode, shortcodeType, amount, phoneNumber, accountReference, transactionDesc, callbackUrl }) {
  try {
    const token = await getAccessToken(credential);
    const timestamp = timestampNow();
    const password = buildPassword(shortcode, credential.passkey, timestamp);

    const response = await fetch(`${BASE_URLS[credential.environment]}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: shortcodeType === 'TILL' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: accountReference.slice(0, 12),
        TransactionDesc: transactionDesc.slice(0, 13),
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ResponseCode !== '0') {
      return { success: false, failureReason: data.errorMessage || data.ResponseDescription || `Daraja rejected the request (HTTP ${response.status})` };
    }
    return { success: true, checkoutRequestId: data.CheckoutRequestID, merchantRequestId: data.MerchantRequestID };
  } catch (err) {
    logger.error('Daraja STK push request failed', { message: err.message });
    return { success: false, failureReason: err.message };
  }
}

// Maps `stkpushquery`'s response to a clean outcome. Critically: "the
// transaction is still being processed" comes back from Daraja as an
// HTTP-level error (commonly `errorCode: '500.001.1001'`), not a
// ResultCode — mapped to PENDING, never FAILED, so a cashier polling
// before the customer has answered the prompt never sees a false
// negative. `stkpushquery` never returns the M-Pesa receipt number itself
// (only the async callback's CallbackMetadata does) — that's handled by
// the caller (services/mpesaPaymentIntent.js), not here.
async function queryStkPushStatus({ credential, shortcode, checkoutRequestId }) {
  try {
    const token = await getAccessToken(credential);
    const timestamp = timestampNow();
    const password = buildPassword(shortcode, credential.passkey, timestamp);

    const response = await fetch(`${BASE_URLS[credential.environment]}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
    });
    const data = await response.json();

    if (!response.ok || data.errorCode) {
      return { outcome: 'PENDING' };
    }

    const resultCode = Number(data.ResultCode);
    if (resultCode === 0) return { outcome: 'SUCCESS', resultCode, resultDesc: data.ResultDesc };
    if (resultCode === 1032) return { outcome: 'CANCELLED', resultCode, resultDesc: data.ResultDesc };
    // Confirmed live against a real (non-sandbox) prompt: Daraja doesn't only signal
    // "still processing" via an HTTP-level error (the shape above) — it can also
    // return a normal 200 with ResultCode 4999, "The transaction is still under
    // processing," while the customer hasn't yet answered the prompt. Treated as
    // PENDING, same as the HTTP-error shape — the first live test of this code
    // mapped it straight to FAILED, which was wrong and is exactly the bug this
    // comment is here to prevent regressing.
    if (resultCode === 4999) return { outcome: 'PENDING' };
    return { outcome: 'FAILED', resultCode, resultDesc: data.ResultDesc };
  } catch (err) {
    logger.error('Daraja STK status query failed', { message: err.message });
    return { outcome: 'PENDING' };
  }
}

export default { getAccessToken, initiateStkPush, queryStkPushStatus };
