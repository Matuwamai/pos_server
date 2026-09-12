import express from 'express';
import locationController from '../controllers/location.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import locationValidation from '../validations/location.js';

const router = express.Router();

router.use(authenticate);

router.get('/', locationController.list);
router.get('/:id', validate(locationValidation.getById), locationController.getById);

// Management actions are OWNER/MANAGER only — cashiers can see locations
// (needed to pick one at login on a shared terminal) but not change them.
router.post('/', requireRole('OWNER', 'MANAGER'), validate(locationValidation.create), locationController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(locationValidation.update), locationController.update);

// Soft delete only — a location can be referenced by orders/inventory/shifts
// going back to day one, so it's never hard-deleted (same reasoning as
// tenants never being hard-deleted, see tenant.service.js).
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(locationValidation.deactivate), locationController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(locationValidation.reactivate), locationController.reactivate);

export default router;
