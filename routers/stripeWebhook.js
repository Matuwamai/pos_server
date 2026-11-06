import express from 'express';
import stripeWebhookController from '../controllers/stripeWebhook.js';

const router = express.Router();

// Stripe's signature check (services/stripePaymentIntent.js's handleWebhookEvent) needs
// the exact raw bytes it signed — this route must never go through the app-wide
// express.json() parser, so it's mounted ahead of that in app.js and parses its own
// body as a raw Buffer here instead.
router.post('/stripe/:tenantId', express.raw({ type: 'application/json' }), stripeWebhookController.handleCheckoutEvent);

export default router;
