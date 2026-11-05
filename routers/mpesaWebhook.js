import express from 'express';
import mpesaWebhookController from '../controllers/mpesaWebhook.js';

const router = express.Router();

router.post('/mpesa/stk-callback/:intentId', mpesaWebhookController.handleStkCallback);

export default router;
