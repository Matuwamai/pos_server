import express from 'express';
import billingController from '../controllers/billing.js';
import validate from '../middlewares/validate.js';
import billingValidation from '../validations/billing.js';
import verifyWebhookSecret from '../middlewares/verifyWebhookSecret.js';

const router = express.Router();

router.post('/webhook', verifyWebhookSecret, validate(billingValidation.webhookEvent), billingController.handleWebhook);

export default router;
