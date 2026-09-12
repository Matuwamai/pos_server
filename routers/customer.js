import express from 'express';
import customerController from '../controllers/customer.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import customerValidation from '../validations/customer.js';

const router = express.Router();

router.use(authenticate);

// Registering/looking up a customer is a normal till-side action, so it's
// open to any authenticated role (a cashier does this at checkout) — only
// editing/deactivating the customer master record is manager-restricted.
router.get('/', validate(customerValidation.list), customerController.list);
router.get('/:id', validate(customerValidation.getById), customerController.getById);
router.post('/', validate(customerValidation.create), customerController.create);

router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(customerValidation.update), customerController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(customerValidation.deactivate), customerController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(customerValidation.reactivate), customerController.reactivate);

export default router;
