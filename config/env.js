import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  africastalking: {
    apiKey: process.env.AFRICASTALKING_API_KEY || null,
    username: process.env.AFRICASTALKING_USERNAME || null,
    senderId: process.env.AFRICASTALKING_SENDER_ID || null,
    // Africa's Talking's own sandbox app for testing without touching the
    // production endpoint/billing.
    sandbox: process.env.AFRICASTALKING_SANDBOX === 'true',
  },
};
