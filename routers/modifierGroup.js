import express from 'express';
import modifierGroupController from '../controllers/modifierGroup.js';
import modifierController from '../controllers/modifier.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import modifierGroupValidation from '../validations/modifierGroup.js';
import modifierValidation from '../validations/modifier.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(modifierGroupValidation.list), modifierGroupController.list);
router.get('/:id', validate(modifierGroupValidation.getById), modifierGroupController.getById);
router.post('/', requireRole('OWNER', 'MANAGER'), validate(modifierGroupValidation.create), modifierGroupController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(modifierGroupValidation.update), modifierGroupController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(modifierGroupValidation.deactivate), modifierGroupController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(modifierGroupValidation.reactivate), modifierGroupController.reactivate);

// Nested: /api/v1/modifier-groups/:modifierGroupId/modifiers
router.get('/:modifierGroupId/modifiers', validate(modifierValidation.list), modifierController.list);
router.get('/:modifierGroupId/modifiers/:id', validate(modifierValidation.getById), modifierController.getById);
router.post('/:modifierGroupId/modifiers', requireRole('OWNER', 'MANAGER'), validate(modifierValidation.create), modifierController.create);
router.patch('/:modifierGroupId/modifiers/:id', requireRole('OWNER', 'MANAGER'), validate(modifierValidation.update), modifierController.update);
router.post('/:modifierGroupId/modifiers/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(modifierValidation.deactivate), modifierController.deactivate);
router.post('/:modifierGroupId/modifiers/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(modifierValidation.reactivate), modifierController.reactivate);

export default router;
