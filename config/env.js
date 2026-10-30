import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Public URL of the web app — used to build links in emails.
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  africastalking: {
    apiKey: process.env.AFRICASTALKING_API_KEY || null,
    username: process.env.AFRICASTALKING_USERNAME || null,
    senderId: process.env.AFRICASTALKING_SENDER_ID || null,
    // Africa's Talking's own sandbox app for testing without touching the
    // production endpoint/billing.
    sandbox: process.env.AFRICASTALKING_SANDBOX === 'true',
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'POS <no-reply@localhost>',
  },
  // Per-IP limits on the public auth endpoints, per window (15 min; signup 1 h).
  rateLimit: {
    login: Number(process.env.RATE_LIMIT_LOGIN) || 20,
    recovery: Number(process.env.RATE_LIMIT_RECOVERY) || 10,
    signup: Number(process.env.RATE_LIMIT_SIGNUP) || 10,
  },
  // AES-256-GCM key (base64, 32 bytes) for encrypting tenant M-Pesa Daraja
  // credentials at rest — see utils/encryption.js.
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || null,
  mpesa: {
    // Base URL Safaricom's STK callback is pointed at. In production this
    // must be a publicly reachable https URL; in dev it can be anything
    // (even unreachable) since status is resolved primarily by polling
    // stkpushquery — the callback only backfills the real receipt number,
    // it's not required for the go/no-go status itself (see
    // services/mpesaPaymentIntent.js).
    callbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || null,
  },
};
