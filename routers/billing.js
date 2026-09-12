import express from 'express';
import billingController from '../controllers/billing.js';
import validate from '../middlewares/validate.js';
import billingValidation from '../validations/billing.js';
import verifyWebhookSecret from '../middlewares/verifyWebhookSecret.js';

const router = express.Router();

// STUB endpoint — see verifyWebhookSecret.js and validations/billing.js for
// what still needs to change once a real billing provider is chosen.
router.post('/webhook', verifyWebhookSecret, validate(billingValidation.webhookEvent), billingController.handleWebhook);

export default router;
