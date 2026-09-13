import express from 'express';
import orderController from '../controllers/order.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import orderValidation from '../validations/order.js';

const router = express.Router();

router.use(authenticate);

// Ringing up a sale is a normal cashier action — no role restriction.
router.get('/', validate(orderValidation.list), orderController.list);
router.get('/:id', validate(orderValidation.getById), orderController.getById);
router.post('/', validate(orderValidation.create), orderController.create);

// Refunds are OWNER/MANAGER only — a common fraud vector, unlike ringing up
// a sale itself.
router.post('/:id/refund', requireRole('OWNER', 'MANAGER'), validate(orderValidation.refund), orderController.refund);

export default router;
