import express from 'express';
import supplierController from '../controllers/supplier.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import supplierValidation from '../validations/supplier.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('suppliers.list'), validate(supplierValidation.list), supplierController.list);
router.get('/:id', requirePermission('suppliers.read'), validate(supplierValidation.getById), supplierController.getById);

router.post('/', requirePermission('suppliers.create'), validate(supplierValidation.create), supplierController.create);
router.patch('/:id', requirePermission('suppliers.update'), validate(supplierValidation.update), supplierController.update);
router.post('/:id/deactivate', requirePermission('suppliers.deactivate'), validate(supplierValidation.deactivate), supplierController.deactivate);
router.post('/:id/reactivate', requirePermission('suppliers.reactivate'), validate(supplierValidation.reactivate), supplierController.reactivate);

export default router;
