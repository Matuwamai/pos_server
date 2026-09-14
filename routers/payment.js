import express from 'express';
import paymentController from '../controllers/payment.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import paymentValidation from '../validations/payment.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('payments.list'), validate(paymentValidation.list), paymentController.list);
router.get('/:id', requirePermission('payments.read'), validate(paymentValidation.getById), paymentController.getById);
router.patch('/:id/status', requirePermission('payments.updateStatus'), validate(paymentValidation.updateStatus), paymentController.updateStatus);

export default router;
