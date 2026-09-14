import express from 'express';
import modifierGroupController from '../controllers/modifierGroup.js';
import modifierController from '../controllers/modifier.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import modifierGroupValidation from '../validations/modifierGroup.js';
import modifierValidation from '../validations/modifier.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('modifierGroups.list'), validate(modifierGroupValidation.list), modifierGroupController.list);
router.get('/:id', requirePermission('modifierGroups.read'), validate(modifierGroupValidation.getById), modifierGroupController.getById);
router.post('/', requirePermission('modifierGroups.create'), validate(modifierGroupValidation.create), modifierGroupController.create);
router.patch('/:id', requirePermission('modifierGroups.update'), validate(modifierGroupValidation.update), modifierGroupController.update);
router.post('/:id/deactivate', requirePermission('modifierGroups.deactivate'), validate(modifierGroupValidation.deactivate), modifierGroupController.deactivate);
router.post('/:id/reactivate', requirePermission('modifierGroups.reactivate'), validate(modifierGroupValidation.reactivate), modifierGroupController.reactivate);

// Nested: /api/v1/modifier-groups/:modifierGroupId/modifiers
router.get('/:modifierGroupId/modifiers', requirePermission('modifiers.list'), validate(modifierValidation.list), modifierController.list);
router.get('/:modifierGroupId/modifiers/:id', requirePermission('modifiers.read'), validate(modifierValidation.getById), modifierController.getById);
router.post('/:modifierGroupId/modifiers', requirePermission('modifiers.create'), validate(modifierValidation.create), modifierController.create);
router.patch('/:modifierGroupId/modifiers/:id', requirePermission('modifiers.update'), validate(modifierValidation.update), modifierController.update);
router.post('/:modifierGroupId/modifiers/:id/deactivate', requirePermission('modifiers.deactivate'), validate(modifierValidation.deactivate), modifierController.deactivate);
router.post('/:modifierGroupId/modifiers/:id/reactivate', requirePermission('modifiers.reactivate'), validate(modifierValidation.reactivate), modifierController.reactivate);

export default router;
