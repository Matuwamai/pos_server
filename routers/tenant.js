import express from 'express';
import tenantController from '../controllers/tenant.js';
import requireSuperAdmin from '../middlewares/requireSuperAdmin.js';
import validate from '../middlewares/validate.js';
import tenantValidation from '../validations/tenant.js';
 
const router = express.Router();
 

router.use(requireSuperAdmin);
 
router.post('/', validate(tenantValidation.create), tenantController.create);
router.get('/', validate(tenantValidation.list), tenantController.list);
router.get('/:id', validate(tenantValidation.getById), tenantController.getById);
router.patch('/:id', validate(tenantValidation.update), tenantController.update);
 
router.post('/:id/suspend', validate(tenantValidation.suspend), tenantController.suspend);
router.post('/:id/reactivate', validate(tenantValidation.reactivate), tenantController.reactivate);
router.post('/:id/cancel', validate(tenantValidation.cancel), tenantController.cancel);
 
 
export default router;
 