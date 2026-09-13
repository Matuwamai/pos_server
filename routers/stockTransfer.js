import express from 'express';
import stockTransferController from '../controllers/stockTransfer.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import stockTransferValidation from '../validations/stockTransfer.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'));

router.get('/', validate(stockTransferValidation.list), stockTransferController.list);
router.get('/:id', validate(stockTransferValidation.getById), stockTransferController.getById);
router.post('/', validate(stockTransferValidation.create), stockTransferController.create);
router.post('/:id/mark-in-transit', validate(stockTransferValidation.markInTransit), stockTransferController.markInTransit);
router.post('/:id/complete', validate(stockTransferValidation.complete), stockTransferController.complete);
router.post('/:id/cancel', validate(stockTransferValidation.cancel), stockTransferController.cancel);

export default router;
