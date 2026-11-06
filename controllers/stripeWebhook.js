import asyncHandler from '../utils/asyncHandler.js';
import stripePaymentIntentService from '../services/stripePaymentIntent.js';
import logger from '../config/logger.js';

const handleCheckoutEvent = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ error: 'Missing Stripe-Signature header' });

  try {
    // req.body is the raw Buffer here (routers/stripeWebhook.js's express.raw()),
    // not JSON-parsed — Stripe's signature check needs the exact bytes it signed.
    await stripePaymentIntentService.handleWebhookEvent(req.params.tenantId, req.body, signature);
  } catch (err) {
    logger.error('Stripe webhook handling failed', { message: err.message, tenantId: req.params.tenantId });
    return res.status(400).json({ error: 'Webhook processing failed' });
  }
  res.status(200).json({ received: true });
});

export default { handleCheckoutEvent };
