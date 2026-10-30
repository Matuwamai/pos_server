// Unit tests for the pure logic (encryption, Daraja response mapping) run
// unconditionally — no network or test tenant needed. The webhook
// idempotency test is a lightweight DB-level integration test (inserts a
// MpesaPaymentIntent row directly via Prisma, rather than going through a
// real Daraja call, which would be slow/flaky/rate-limited in CI — see
// services/mpesaDaraja.js's doc comment on the sandbox's observed rate
// limit).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// A fixed, test-only key — unrelated to any real deployment's
// DATA_ENCRYPTION_KEY, which must never appear in source control.
process.env.DATA_ENCRYPTION_KEY ||= 'DWSlobNVd3a8VAO/7uYfP6PZnTbBsRiyEOui4kH8oI8=';

const encryption = (await import('../utils/encryption.js')).default;
const mpesaDaraja = (await import('../services/mpesaDaraja.js')).default;

describe('M-Pesa encryption', () => {
  test('round-trips a plaintext value', () => {
    const packed = encryption.encrypt('my-secret-passkey');
    assert.notEqual(packed, 'my-secret-passkey');
    assert.equal(encryption.decrypt(packed), 'my-secret-passkey');
  });

  test('two encryptions of the same plaintext differ (random IV)', () => {
    assert.notEqual(encryption.encrypt('same'), encryption.encrypt('same'));
  });

  test('rejects a malformed packed value', () => {
    assert.throws(() => encryption.decrypt('not-a-valid-packed-value'));
  });
});

describe('M-Pesa Daraja response mapping', () => {
  const credential = { consumerKey: 'ck', consumerSecret: 'cs', passkey: 'pk', environment: 'SANDBOX' };
  let originalFetch;
  function mockFetch(handler) {
    originalFetch = globalThis.fetch;
    globalThis.fetch = handler;
  }
  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

  test('queryStkPushStatus maps ResultCode 0 to SUCCESS', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ ResultCode: '0', ResultDesc: 'The service request is processed successfully.' }), { status: 200 });
    });
    try {
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: '174379', checkoutRequestId: 'ws_CO_test' });
      assert.equal(result.outcome, 'SUCCESS');
      assert.equal(result.resultCode, 0);
    } finally {
      restoreFetch();
    }
  });

  test('queryStkPushStatus maps ResultCode 1032 to CANCELLED', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ ResultCode: '1032', ResultDesc: 'Request cancelled by user' }), { status: 200 });
    });
    try {
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: '174379', checkoutRequestId: 'ws_CO_test' });
      assert.equal(result.outcome, 'CANCELLED');
    } finally {
      restoreFetch();
    }
  });

  test('queryStkPushStatus maps another non-zero ResultCode to FAILED', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ ResultCode: '1', ResultDesc: 'Insufficient balance' }), { status: 200 });
    });
    try {
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: '174379', checkoutRequestId: 'ws_CO_test' });
      assert.equal(result.outcome, 'FAILED');
    } finally {
      restoreFetch();
    }
  });

  // Confirmed live against the real sandbox while building this: a prompt
  // that hasn't been answered yet comes back as an HTTP-level error
  // (errorCode set, no ResultCode), not a clean ResultCode — this must
  // never be read as FAILED, or a cashier polling early would see a false
  // negative.
  test('queryStkPushStatus maps the "still processing" error shape to PENDING, not FAILED', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ errorCode: '500.001.1001', errorMessage: 'The transaction is being processed' }), { status: 500 });
    });
    try {
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: '174379', checkoutRequestId: 'ws_CO_test' });
      assert.equal(result.outcome, 'PENDING');
    } finally {
      restoreFetch();
    }
  });

  // Confirmed live: Safaricom's sandbox also rate-limits stkpushquery with
  // a plain HTTP 429 and no errorCode field at all — must also be PENDING.
  test('queryStkPushStatus maps a bare rate-limit response to PENDING', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ fault: { faultstring: 'Spike arrest violation' } }), { status: 429 });
    });
    try {
      const result = await mpesaDaraja.queryStkPushStatus({ credential, shortcode: '174379', checkoutRequestId: 'ws_CO_test' });
      assert.equal(result.outcome, 'PENDING');
    } finally {
      restoreFetch();
    }
  });

  test('initiateStkPush returns success with the checkout/merchant request ids', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ ResponseCode: '0', CheckoutRequestID: 'ws_CO_abc', MerchantRequestID: 'mr_abc' }), { status: 200 });
    });
    try {
      const result = await mpesaDaraja.initiateStkPush({
        credential, shortcode: '174379', shortcodeType: 'PAYBILL', amount: 10, phoneNumber: '254708374149',
        accountReference: 'Acme', transactionDesc: 'POS sale', callbackUrl: 'https://example.com/cb',
      });
      assert.equal(result.success, true);
      assert.equal(result.checkoutRequestId, 'ws_CO_abc');
    } finally {
      restoreFetch();
    }
  });

  test('initiateStkPush returns failure (never throws) on a Daraja rejection', async () => {
    mockFetch(async (url) => {
      if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: '3599' }), { status: 200 });
      return new Response(JSON.stringify({ errorMessage: 'Invalid CallBackURL' }), { status: 400 });
    });
    try {
      const result = await mpesaDaraja.initiateStkPush({
        credential, shortcode: '174379', shortcodeType: 'PAYBILL', amount: 10, phoneNumber: '254708374149',
        accountReference: 'Acme', transactionDesc: 'POS sale', callbackUrl: 'not-a-url',
      });
      assert.equal(result.success, false);
      assert.ok(result.failureReason);
    } finally {
      restoreFetch();
    }
  });
});

// Integration: webhook idempotency, direct against the real dev DB/server.
// Needs the same test tenant as tests/sync.test.js.
const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000/api/v1';
const CONFIGURED = Boolean(process.env.TEST_SUBDOMAIN && process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
const skip = CONFIGURED ? false : 'set TEST_SUBDOMAIN, TEST_EMAIL and TEST_PASSWORD to run';

describe('M-Pesa STK webhook idempotency', { skip }, () => {
  test('a callback delivered twice only applies once', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const login = await (await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: process.env.TEST_SUBDOMAIN, email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
    })).json();
    assert.ok(login.token, 'test login must succeed');

    // Decode the tenantId straight off the JWT payload rather than adding
    // a /auth/me round trip just for this test.
    const tenantId = JSON.parse(Buffer.from(login.token.split('.')[1], 'base64url').toString()).tenantId;

    const intent = await prisma.mpesaPaymentIntent.create({
      data: {
        tenantId,
        amount: 10,
        phoneNumber: '254708374149',
        checkoutRequestId: `ws_CO_idem_${randomUUID()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const callback = {
      Body: {
        stkCallback: {
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'QCX7Y8ZABC' }, { Name: 'Amount', Value: 10 }] },
        },
      },
    };

    const first = await fetch(`${BASE}/webhooks/mpesa/stk-callback/${intent.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callback),
    });
    assert.equal(first.status, 200);

    const afterFirst = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(afterFirst.status, 'COMPLETED');
    assert.equal(afterFirst.mpesaReceiptNumber, 'QCX7Y8ZABC');

    // Replay with a different (bogus) outcome — idempotency must mean this
    // can never flip an already-resolved intent.
    const replayCallback = { Body: { stkCallback: { ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } };
    const second = await fetch(`${BASE}/webhooks/mpesa/stk-callback/${intent.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replayCallback),
    });
    assert.equal(second.status, 200);

    const afterSecond = await prisma.mpesaPaymentIntent.findUnique({ where: { id: intent.id } });
    assert.equal(afterSecond.status, 'COMPLETED', 'a replayed callback must not flip an already-resolved intent');
    assert.equal(afterSecond.mpesaReceiptNumber, 'QCX7Y8ZABC');

    await prisma.mpesaPaymentIntent.delete({ where: { id: intent.id } });
    await prisma.$disconnect();
  });
});
