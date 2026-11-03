import express from 'express';
import promotionController from '../controllers/promotion.js';
import { authenticateSyncClient } from '../middlewares/authenticateTerminal.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import promotionValidation from '../validations/promotion.js';

const router = express.Router();

// Dispatches to a tenant-user JWT or a device (terminal) token, same as
// /sync/* and /orders/* — a till needs to preview a promo code's discount
// live (GET /by-code/:code below) before applying it offline, but every
// other route here stays admin-only: TERMINAL_PERMISSIONS only grants a
// device token 'promotions.byCode', nothing else, so requirePermission
// still 403s a device token on list/create/update/deactivate/reactivate.
router.use(authenticateSyncClient);

router.get('/', requirePermission('promotions.list'), validate(promotionValidation.list), promotionController.list);
router.get('/by-code/:code', requirePermission('promotions.byCode'), validate(promotionValidation.byCodeParams), promotionController.getByCode);
router.get('/:id', requirePermission('promotions.read'), validate(promotionValidation.getById), promotionController.getById);

router.post('/', requirePermission('promotions.create'), validate(promotionValidation.create), promotionController.create);
router.patch('/:id', requirePermission('promotions.update'), validate(promotionValidation.update), promotionController.update);
router.post('/:id/deactivate', requirePermission('promotions.deactivate'), validate(promotionValidation.deactivate), promotionController.deactivate);
router.post('/:id/reactivate', requirePermission('promotions.reactivate'), validate(promotionValidation.reactivate), promotionController.reactivate);

export default router;
