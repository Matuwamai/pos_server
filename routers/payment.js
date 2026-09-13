import express from 'express';
import paymentController from '../controllers/payment.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import paymentValidation from '../validations/payment.js';

const router = express.Router();

router.use(authenticate);
// Reporting across every order's payments is more sensitive than any one
// order's own detail (already visible via GET /orders/:id to any role) —
// OWNER/MANAGER only.
router.use(requireRole('OWNER', 'MANAGER'));

router.get('/', validate(paymentValidation.list), paymentController.list);
router.get('/:id', validate(paymentValidation.getById), paymentController.getById);
router.patch('/:id/status', validate(paymentValidation.updateStatus), paymentController.updateStatus);

export default router;
