import express from 'express';
import promotionController from '../controllers/promotion.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import promotionValidation from '../validations/promotion.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('promotions.list'), validate(promotionValidation.list), promotionController.list);
router.get('/by-code/:code', requirePermission('promotions.byCode'), validate(promotionValidation.byCodeParams), promotionController.getByCode);
router.get('/:id', requirePermission('promotions.read'), validate(promotionValidation.getById), promotionController.getById);

router.post('/', requirePermission('promotions.create'), validate(promotionValidation.create), promotionController.create);
router.patch('/:id', requirePermission('promotions.update'), validate(promotionValidation.update), promotionController.update);
router.post('/:id/deactivate', requirePermission('promotions.deactivate'), validate(promotionValidation.deactivate), promotionController.deactivate);
router.post('/:id/reactivate', requirePermission('promotions.reactivate'), validate(promotionValidation.reactivate), promotionController.reactivate);

export default router;
