import express from 'express';
import userController from '../controllers/user.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import userValidation from '../validations/user.js';

const router = express.Router();

router.use(authenticate);

// Self-service — any authenticated role. Declared before /:id so "me"
// is never mistaken for a UUID param.
router.get('/me', userController.getMe);
router.post('/me/change-password', validate(userValidation.changeOwnPassword), userController.changeOwnPassword);

// Staff management — gated by permission, with a further OWNER-vs-MANAGER
// privilege split still enforced inside the service (a MANAGER can't
// create, promote to, or touch an OWNER/MANAGER-level account) — that
// nuance depends on both the acting user's and the target's level, so it
// isn't expressible as a single permission code.
router.get('/', requirePermission('users.list'), validate(userValidation.list), userController.list);
router.get('/:id', requirePermission('users.read'), validate(userValidation.getById), userController.getById);
router.post('/', requirePermission('users.create'), validate(userValidation.create), userController.create);
router.patch('/:id', requirePermission('users.update'), validate(userValidation.update), userController.update);
router.post('/:id/deactivate', requirePermission('users.deactivate'), validate(userValidation.deactivate), userController.deactivate);
router.post('/:id/reactivate', requirePermission('users.reactivate'), validate(userValidation.reactivate), userController.reactivate);
router.post('/:id/reset-password', requirePermission('users.resetPassword'), validate(userValidation.resetPassword), userController.resetPassword);

export default router;
