import express from 'express';
import supplierController from '../controllers/supplier.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import supplierValidation from '../validations/supplier.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(supplierValidation.list), supplierController.list);
router.get('/:id', validate(supplierValidation.getById), supplierController.getById);

// Supplier/purchasing setup is a back-office function — OWNER/MANAGER plus
// INVENTORY_CLERK, since that role exists specifically for this kind of work.
router.post('/', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(supplierValidation.create), supplierController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(supplierValidation.update), supplierController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(supplierValidation.deactivate), supplierController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER', 'INVENTORY_CLERK'), validate(supplierValidation.reactivate), supplierController.reactivate);

export default router;
