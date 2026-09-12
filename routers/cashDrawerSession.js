import express from 'express';
import cashDrawerSessionController from '../controllers/cashDrawerSession.js';
import authenticate from '../middlewares/authenticate.js';
import validate from '../middlewares/validate.js';
import cashDrawerSessionValidation from '../validations/cashDrawerSession.js';

const router = express.Router();

router.use(authenticate);

// No role restriction here, unlike location/terminal management — opening
// and closing your own till is a normal cashier action, not a manager one.
// closeSession still enforces that a CASHIER can only close a session they
// themselves opened; a MANAGER/OWNER can close any of them.
router.post('/', validate(cashDrawerSessionValidation.open), cashDrawerSessionController.open);
router.get('/', validate(cashDrawerSessionValidation.list), cashDrawerSessionController.list);
router.get('/:id', validate(cashDrawerSessionValidation.getById), cashDrawerSessionController.getById);
router.post('/:id/close', validate(cashDrawerSessionValidation.close), cashDrawerSessionController.close);

export default router;
