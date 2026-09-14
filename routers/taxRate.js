import express from 'express';
import taxRateController from '../controllers/taxRate.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import taxRateValidation from '../validations/taxRate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('taxRates.list'), validate(taxRateValidation.list), taxRateController.list);
router.get('/default', requirePermission('taxRates.default'), taxRateController.getDefault);
router.get('/:id', requirePermission('taxRates.read'), validate(taxRateValidation.getById), taxRateController.getById);

router.post('/', requirePermission('taxRates.create'), validate(taxRateValidation.create), taxRateController.create);
router.patch('/:id', requirePermission('taxRates.update'), validate(taxRateValidation.update), taxRateController.update);
router.post('/:id/deactivate', requirePermission('taxRates.deactivate'), validate(taxRateValidation.deactivate), taxRateController.deactivate);
router.post('/:id/reactivate', requirePermission('taxRates.reactivate'), validate(taxRateValidation.reactivate), taxRateController.reactivate);

export default router;
