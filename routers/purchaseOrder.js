import express from 'express';
import purchaseOrderController from '../controllers/purchaseOrder.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import purchaseOrderValidation from '../validations/purchaseOrder.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'));

router.get('/', validate(purchaseOrderValidation.list), purchaseOrderController.list);
router.get('/:id', validate(purchaseOrderValidation.getById), purchaseOrderController.getById);
router.post('/', validate(purchaseOrderValidation.create), purchaseOrderController.create);
router.patch('/:id', validate(purchaseOrderValidation.update), purchaseOrderController.update);
router.post('/:id/mark-ordered', validate(purchaseOrderValidation.markOrdered), purchaseOrderController.markOrdered);
router.post('/:id/receive', validate(purchaseOrderValidation.receive), purchaseOrderController.receive);
router.post('/:id/cancel', validate(purchaseOrderValidation.cancel), purchaseOrderController.cancel);

export default router;
