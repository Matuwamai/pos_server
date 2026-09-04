import express from 'express';
import tenantController from '../controllers/tenant.js';
import requireSuperAdmin from '../middlewares/requireSuperAdmin.js';
import validate from '../middlewares/validate.js';
import tenantValidation from '../validations/tenant.js';
 
const router = express.Router();
 
// Every route here is a platform-admin operation — see requireSuperAdmin.js
// for the auth caveat.
router.use(requireSuperAdmin);
 
router.post('/', validate(tenantValidation.create), tenantController.create);
router.get('/', validate(tenantValidation.list), tenantController.list);
router.get('/:id', validate(tenantValidation.getById), tenantController.getById);
router.patch('/:id', validate(tenantValidation.update), tenantController.update);
 
// Status transitions are explicit actions rather than a generic PATCH
// {status} so each one is intent-revealing and easy to audit/log distinctly.
router.post('/:id/suspend', validate(tenantValidation.suspend), tenantController.suspend);
router.post('/:id/reactivate', validate(tenantValidation.reactivate), tenantController.reactivate);
router.post('/:id/cancel', validate(tenantValidation.cancel), tenantController.cancel);
 
// Deliberately no DELETE /:id — tenants are never hard-deleted (see
// tenant.service.js cancelTenant for why).
 
export default router;
 