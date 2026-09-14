import express from 'express';
import locationController from '../controllers/location.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import locationValidation from '../validations/location.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('locations.list'), validate(locationValidation.list), locationController.list);
router.get('/:id', requirePermission('locations.read'), validate(locationValidation.getById), locationController.getById);

router.post('/', requirePermission('locations.create'), validate(locationValidation.create), locationController.create);
router.patch('/:id', requirePermission('locations.update'), validate(locationValidation.update), locationController.update);

// Soft delete only — a location can be referenced by orders/inventory/shifts
// going back to day one, so it's never hard-deleted (same reasoning as
// tenants never being hard-deleted, see tenant.service.js).
router.post('/:id/deactivate', requirePermission('locations.deactivate'), validate(locationValidation.deactivate), locationController.deactivate);
router.post('/:id/reactivate', requirePermission('locations.reactivate'), validate(locationValidation.reactivate), locationController.reactivate);

export default router;
