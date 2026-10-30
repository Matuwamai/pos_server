import express from 'express';
import mpesaWebhookController from '../controllers/mpesaWebhook.js';

const router = express.Router();

// No auth — Daraja doesn't sign callbacks. Tenant is resolved from the
// unguessable intent id itself (see services/mpesaPaymentIntent.js).
router.post('/mpesa/stk-callback/:intentId', mpesaWebhookController.handleStkCallback);

export default router;
