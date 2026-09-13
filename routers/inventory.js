import express from 'express';
import inventoryController from '../controllers/inventory.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import inventoryValidation from '../validations/inventory.js';

const router = express.Router();

router.use(authenticate);

// Declared before /:id so it isn't swallowed by the dynamic route.
router.get('/logs', validate(inventoryValidation.listLogs), inventoryController.listLogs);

router.get('/', validate(inventoryValidation.list), inventoryController.list);
router.get('/:id', validate(inventoryValidation.getById), inventoryController.getById);

// Only lowStockThreshold is editable via PATCH — quantity changes exclusively
// through /adjustments (or a PO/transfer), so every change is logged.
router.patch('/:id', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(inventoryValidation.update), inventoryController.update);
router.post('/adjustments', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(inventoryValidation.adjust), inventoryController.adjust);

export default router;
