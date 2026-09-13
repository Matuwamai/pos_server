import express from 'express';
import userController from '../controllers/user.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import userValidation from '../validations/user.js';

const router = express.Router();

router.use(authenticate);

// Self-service — any authenticated role. Declared before /:id so "me"
// is never mistaken for a UUID param.
router.get('/me', userController.getMe);
router.post('/me/change-password', validate(userValidation.changeOwnPassword), userController.changeOwnPassword);

// Staff management — OWNER/MANAGER only, with a further OWNER-vs-MANAGER
// privilege split enforced inside the service (a MANAGER can't create,
// promote to, or touch an OWNER/MANAGER-level account).
router.get('/', requireRole('OWNER', 'MANAGER'), validate(userValidation.list), userController.list);
router.get('/:id', requireRole('OWNER', 'MANAGER'), validate(userValidation.getById), userController.getById);
router.post('/', requireRole('OWNER', 'MANAGER'), validate(userValidation.create), userController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(userValidation.update), userController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(userValidation.deactivate), userController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(userValidation.reactivate), userController.reactivate);
router.post('/:id/reset-password', requireRole('OWNER', 'MANAGER'), validate(userValidation.resetPassword), userController.resetPassword);

export default router;
