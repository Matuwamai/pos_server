import express from 'express';
import terminalController from '../controllers/terminal.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import terminalValidation from '../validations/terminal.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('terminals.list'), validate(terminalValidation.list), terminalController.list);
router.get('/:id', requirePermission('terminals.read'), validate(terminalValidation.getById), terminalController.getById);
router.post('/:id/heartbeat', requirePermission('terminals.heartbeat'), validate(terminalValidation.heartbeat), terminalController.heartbeat);

router.post('/', requirePermission('terminals.create'), validate(terminalValidation.create), terminalController.create);
router.patch('/:id', requirePermission('terminals.update'), validate(terminalValidation.update), terminalController.update);
router.post('/:id/deactivate', requirePermission('terminals.deactivate'), validate(terminalValidation.deactivate), terminalController.deactivate);
router.post('/:id/reactivate', requirePermission('terminals.reactivate'), validate(terminalValidation.reactivate), terminalController.reactivate);

export default router;
