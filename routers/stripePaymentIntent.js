import express from 'express';
import stripePaymentIntentController from '../controllers/stripePaymentIntent.js';
import stripePaymentIntentValidation from '../validations/stripePaymentIntent.js';
import { authenticateSyncClient } from '../middlewares/authenticateTerminal.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.use(authenticateSyncClient);

router.post('/', requirePermission('paymentIntents.create'), validate(stripePaymentIntentValidation.create), stripePaymentIntentController.create);
router.get('/:id', requirePermission('paymentIntents.read'), validate(stripePaymentIntentValidation.getById), stripePaymentIntentController.getById);

export default router;
