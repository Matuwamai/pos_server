import express from 'express';
import stockTransferController from '../controllers/stockTransfer.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import stockTransferValidation from '../validations/stockTransfer.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('stockTransfers.list'), validate(stockTransferValidation.list), stockTransferController.list);
router.get('/:id', requirePermission('stockTransfers.read'), validate(stockTransferValidation.getById), stockTransferController.getById);
router.post('/', requirePermission('stockTransfers.create'), validate(stockTransferValidation.create), stockTransferController.create);
router.post('/:id/mark-in-transit', requirePermission('stockTransfers.markInTransit'), validate(stockTransferValidation.markInTransit), stockTransferController.markInTransit);
router.post('/:id/complete', requirePermission('stockTransfers.complete'), validate(stockTransferValidation.complete), stockTransferController.complete);
router.post('/:id/cancel', requirePermission('stockTransfers.cancel'), validate(stockTransferValidation.cancel), stockTransferController.cancel);

export default router;
