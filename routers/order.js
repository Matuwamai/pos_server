import express from 'express';
import orderController from '../controllers/order.js';
import receiptController from '../controllers/receipt.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import orderValidation from '../validations/order.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('orders.list'), validate(orderValidation.list), orderController.list);
router.get('/:id', requirePermission('orders.read'), validate(orderValidation.getById), orderController.getById);
// Just a formatted view of an order the caller can already read — no
// separate permission needed.
router.get('/:id/receipt', requirePermission('orders.read'), validate(orderValidation.getById), receiptController.getReceipt);
router.post('/', requirePermission('orders.create'), validate(orderValidation.create), orderController.create);
router.post('/:id/refund', requirePermission('orders.refund'), validate(orderValidation.refund), orderController.refund);

export default router;
