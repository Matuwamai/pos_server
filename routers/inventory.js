import express from 'express';
import inventoryController from '../controllers/inventory.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import inventoryValidation from '../validations/inventory.js';

const router = express.Router();

router.use(authenticate);

router.get('/logs', requirePermission('inventory.logs.list'), validate(inventoryValidation.listLogs), inventoryController.listLogs);

router.get('/', requirePermission('inventory.list'), validate(inventoryValidation.list), inventoryController.list);
router.get('/:id', requirePermission('inventory.read'), validate(inventoryValidation.getById), inventoryController.getById);
router.patch('/:id', requirePermission('inventory.update'), validate(inventoryValidation.update), inventoryController.update);
router.post('/adjustments', requirePermission('inventory.adjust'), validate(inventoryValidation.adjust), inventoryController.adjust);

export default router;
