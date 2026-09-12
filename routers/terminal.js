import express from 'express';
import terminalController from '../controllers/terminal.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import terminalValidation from '../validations/terminal.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(terminalValidation.list), terminalController.list);
router.get('/:id', validate(terminalValidation.getById), terminalController.getById);

// Heartbeat is called by the till app itself, not a manager — any
// authenticated tenant user (e.g. a cashier signed in on that device) can
// ping it, so no role restriction here.
router.post('/:id/heartbeat', validate(terminalValidation.heartbeat), terminalController.heartbeat);

// Manager-driven registration/management only.
router.post('/', requireRole('OWNER', 'MANAGER'), validate(terminalValidation.create), terminalController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(terminalValidation.update), terminalController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(terminalValidation.deactivate), terminalController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(terminalValidation.reactivate), terminalController.reactivate);

export default router;
