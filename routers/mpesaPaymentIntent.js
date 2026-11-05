import express from 'express';
import mpesaPaymentIntentController from '../controllers/mpesaPaymentIntent.js';
import mpesaPaymentIntentValidation from '../validations/mpesaPaymentIntent.js';
import { authenticateSyncClient } from '../middlewares/authenticateTerminal.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.use(authenticateSyncClient);

router.post('/', requirePermission('paymentIntents.create'), validate(mpesaPaymentIntentValidation.create), mpesaPaymentIntentController.create);
router.get('/:id', requirePermission('paymentIntents.read'), validate(mpesaPaymentIntentValidation.getById), mpesaPaymentIntentController.getById);

export default router;
