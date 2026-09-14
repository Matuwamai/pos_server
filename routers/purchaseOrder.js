import express from 'express';
import purchaseOrderController from '../controllers/purchaseOrder.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import purchaseOrderValidation from '../validations/purchaseOrder.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('purchaseOrders.list'), validate(purchaseOrderValidation.list), purchaseOrderController.list);
router.get('/:id', requirePermission('purchaseOrders.read'), validate(purchaseOrderValidation.getById), purchaseOrderController.getById);
router.post('/', requirePermission('purchaseOrders.create'), validate(purchaseOrderValidation.create), purchaseOrderController.create);
router.patch('/:id', requirePermission('purchaseOrders.update'), validate(purchaseOrderValidation.update), purchaseOrderController.update);
router.post('/:id/mark-ordered', requirePermission('purchaseOrders.markOrdered'), validate(purchaseOrderValidation.markOrdered), purchaseOrderController.markOrdered);
router.post('/:id/receive', requirePermission('purchaseOrders.receive'), validate(purchaseOrderValidation.receive), purchaseOrderController.receive);
router.post('/:id/cancel', requirePermission('purchaseOrders.cancel'), validate(purchaseOrderValidation.cancel), purchaseOrderController.cancel);

export default router;
