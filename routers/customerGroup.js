import express from 'express';
import customerGroupController from '../controllers/customerGroup.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import customerGroupValidation from '../validations/customerGroup.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('customerGroups.list'), validate(customerGroupValidation.list), customerGroupController.list);
router.get('/:id', requirePermission('customerGroups.read'), validate(customerGroupValidation.getById), customerGroupController.getById);

router.post('/', requirePermission('customerGroups.create'), validate(customerGroupValidation.create), customerGroupController.create);
router.patch('/:id', requirePermission('customerGroups.update'), validate(customerGroupValidation.update), customerGroupController.update);
router.post('/:id/deactivate', requirePermission('customerGroups.deactivate'), validate(customerGroupValidation.deactivate), customerGroupController.deactivate);
router.post('/:id/reactivate', requirePermission('customerGroups.reactivate'), validate(customerGroupValidation.reactivate), customerGroupController.reactivate);

export default router;
