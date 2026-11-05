import express from 'express';
import userController from '../controllers/user.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import userValidation from '../validations/user.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate(userValidation.updateMe), userController.updateMe);
router.post('/me/change-password', validate(userValidation.changeOwnPassword), userController.changeOwnPassword);
router.get('/', requirePermission('users.list'), validate(userValidation.list), userController.list);
router.get('/:id', requirePermission('users.read'), validate(userValidation.getById), userController.getById);
router.post('/', requirePermission('users.create'), validate(userValidation.create), userController.create);
router.patch('/:id', requirePermission('users.update'), validate(userValidation.update), userController.update);
router.post('/:id/deactivate', requirePermission('users.deactivate'), validate(userValidation.deactivate), userController.deactivate);
router.post('/:id/reactivate', requirePermission('users.reactivate'), validate(userValidation.reactivate), userController.reactivate);
router.post('/:id/reset-password', requirePermission('users.resetPassword'), validate(userValidation.resetPassword), userController.resetPassword);

export default router;
