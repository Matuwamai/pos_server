import express from 'express';
import tenantSelfController from '../controllers/tenantSelf.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import uploadImage from '../middlewares/uploadImage.js';

const router = express.Router();

router.use(authenticate);

// No permission gate: every authenticated tenant user (any role) needs to
// read their own tenant's name/logo to render the topbar/sidebar.
router.get('/', tenantSelfController.getMine);

router.patch('/logo', requirePermission('tenant.branding.update'), uploadImage.single('logo'), tenantSelfController.updateLogo);
router.delete('/logo', requirePermission('tenant.branding.update'), tenantSelfController.removeLogo);

export default router;
