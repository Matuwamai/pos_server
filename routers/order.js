import express from 'express';
import orderController from '../controllers/order.js';
import receiptController from '../controllers/receipt.js';
import { authenticateSyncClient } from '../middlewares/authenticateTerminal.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import orderValidation from '../validations/order.js';

const router = express.Router();

// Dispatches to a tenant-user JWT or a device (terminal) token, same as
// /sync/* and /payment-intents/* — a till needs to look up and refund an
// order (GET/:id/refund below), but NOT create one online directly: its own
// sales always go through the offline-sync order.create outbox path, so
// 'orders.create' is deliberately never added to authenticateTerminal.js's
// TERMINAL_PERMISSIONS, keeping that path 403'd for a device token.
router.use(authenticateSyncClient);

router.get('/', requirePermission('orders.list'), validate(orderValidation.list), orderController.list);
router.get('/:id', requirePermission('orders.read'), validate(orderValidation.getById), orderController.getById);
// Just a formatted view of an order the caller can already read — no
// separate permission needed.
router.get('/:id/receipt', requirePermission('orders.read'), validate(orderValidation.getById), receiptController.getReceipt);
router.post('/', requirePermission('orders.create'), validate(orderValidation.create), orderController.create);
router.post('/:id/refund', requirePermission('orders.refund'), validate(orderValidation.refund), orderController.refund);

export default router;
