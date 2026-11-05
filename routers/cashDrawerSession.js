import express from 'express';
import cashDrawerSessionController from '../controllers/cashDrawerSession.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import cashDrawerSessionValidation from '../validations/cashDrawerSession.js';

const router = express.Router();

router.use(authenticate);
router.post('/', requirePermission('cashDrawerSessions.create'), validate(cashDrawerSessionValidation.open), cashDrawerSessionController.open);
router.get('/', requirePermission('cashDrawerSessions.list'), validate(cashDrawerSessionValidation.list), cashDrawerSessionController.list);
router.get('/:id', requirePermission('cashDrawerSessions.read'), validate(cashDrawerSessionValidation.getById), cashDrawerSessionController.getById);
router.post('/:id/close', requirePermission('cashDrawerSessions.close'), validate(cashDrawerSessionValidation.close), cashDrawerSessionController.close);

export default router;
