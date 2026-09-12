import express from 'express';
import customerGroupController from '../controllers/customerGroup.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import customerGroupValidation from '../validations/customerGroup.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(customerGroupValidation.list), customerGroupController.list);
router.get('/:id', validate(customerGroupValidation.getById), customerGroupController.getById);

router.post('/', requireRole('OWNER', 'MANAGER'), validate(customerGroupValidation.create), customerGroupController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(customerGroupValidation.update), customerGroupController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(customerGroupValidation.deactivate), customerGroupController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(customerGroupValidation.reactivate), customerGroupController.reactivate);

export default router;
