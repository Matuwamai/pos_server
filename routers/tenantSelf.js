import express from 'express';
import tenantSelfController from '../controllers/tenantSelf.js';
import tenantSelfValidation from '../validations/tenantSelf.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import uploadImage from '../middlewares/uploadImage.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.use(authenticate);

// No permission gate: every authenticated tenant user (any role) needs to
// read their own tenant's name/logo/M-Pesa till-paybill number — the latter
// is shown at the point of sale, not just on a settings page.
router.get('/', tenantSelfController.getMine);

router.patch('/logo', requirePermission('tenant.branding.update'), uploadImage.single('logo'), tenantSelfController.updateLogo);
router.delete('/logo', requirePermission('tenant.branding.update'), tenantSelfController.removeLogo);

router.patch('/payments', requirePermission('tenant.payments.update'), validate(tenantSelfValidation.updatePayments), tenantSelfController.updatePayments);

export default router;
