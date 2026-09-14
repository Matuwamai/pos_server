import express from 'express';
import customerController from '../controllers/customer.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import customerValidation from '../validations/customer.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('customers.list'), validate(customerValidation.list), customerController.list);
router.get('/:id', requirePermission('customers.read'), validate(customerValidation.getById), customerController.getById);
router.post('/', requirePermission('customers.create'), validate(customerValidation.create), customerController.create);

router.patch('/:id', requirePermission('customers.update'), validate(customerValidation.update), customerController.update);
router.post('/:id/deactivate', requirePermission('customers.deactivate'), validate(customerValidation.deactivate), customerController.deactivate);
router.post('/:id/reactivate', requirePermission('customers.reactivate'), validate(customerValidation.reactivate), customerController.reactivate);

export default router;
