import express from 'express';
import taxRateController from '../controllers/taxRate.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import taxRateValidation from '../validations/taxRate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(taxRateValidation.list), taxRateController.list);
router.get('/default', taxRateController.getDefault);
router.get('/:id', validate(taxRateValidation.getById), taxRateController.getById);

router.post('/', requireRole('OWNER', 'MANAGER'), validate(taxRateValidation.create), taxRateController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(taxRateValidation.update), taxRateController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(taxRateValidation.deactivate), taxRateController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(taxRateValidation.reactivate), taxRateController.reactivate);

export default router;
