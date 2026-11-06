import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  africastalking: {
    apiKey: process.env.AFRICASTALKING_API_KEY || null,
    username: process.env.AFRICASTALKING_USERNAME || null,
    senderId: process.env.AFRICASTALKING_SENDER_ID || null,
    sandbox: process.env.AFRICASTALKING_SANDBOX === 'true',
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'POS <no-reply@localhost>',
  },
  rateLimit: {
    login: Number(process.env.RATE_LIMIT_LOGIN) || 20,
    recovery: Number(process.env.RATE_LIMIT_RECOVERY) || 10,
    signup: Number(process.env.RATE_LIMIT_SIGNUP) || 10,
  },

  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || null,
  mpesa: {
    callbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || null,
  },
  stripe: {
    webhookBaseUrl: process.env.STRIPE_WEBHOOK_BASE_URL || null,
  },
};
