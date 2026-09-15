import express from 'express';
import invoiceController from '../controllers/invoice.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import invoiceValidation from '../validations/invoice.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('invoices.list'), validate(invoiceValidation.list), invoiceController.list);
router.get('/:id', requirePermission('invoices.read'), validate(invoiceValidation.getById), invoiceController.getById);
router.get('/:id/document', requirePermission('invoices.read'), validate(invoiceValidation.getById), invoiceController.getDocument);

router.post('/', requirePermission('invoices.create'), validate(invoiceValidation.create), invoiceController.create);
router.patch('/:id', requirePermission('invoices.update'), validate(invoiceValidation.update), invoiceController.update);
router.post('/:id/issue', requirePermission('invoices.issue'), validate(invoiceValidation.issue), invoiceController.issue);
router.post('/:id/payments', requirePermission('invoices.recordPayment'), validate(invoiceValidation.recordPayment), invoiceController.recordPayment);
router.post('/:id/void', requirePermission('invoices.void'), validate(invoiceValidation.void), invoiceController.void);

export default router;
