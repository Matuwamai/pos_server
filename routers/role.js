import express from 'express';
import roleController from '../controllers/role.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import roleValidation from '../validations/role.js';

const router = express.Router();

router.use(authenticate);

// New resource, so it uses the new requirePermission system from the
// start rather than requireRole — these codes are OWNER-only in the
// default seed (config/defaultRolePermissions.js), but a tenant can grant
// them to any role it wants.
router.get('/', requirePermission('roles.list'), validate(roleValidation.list), roleController.list);
router.get('/:id', requirePermission('roles.read'), validate(roleValidation.getById), roleController.getById);
router.post('/', requirePermission('roles.create'), validate(roleValidation.create), roleController.create);
router.patch('/:id', requirePermission('roles.update'), validate(roleValidation.update), roleController.update);
router.post('/:id/deactivate', requirePermission('roles.deactivate'), validate(roleValidation.deactivate), roleController.deactivate);
router.post('/:id/reactivate', requirePermission('roles.reactivate'), validate(roleValidation.reactivate), roleController.reactivate);

export default router;
