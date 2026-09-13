import express from 'express';
import promotionController from '../controllers/promotion.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import promotionValidation from '../validations/promotion.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(promotionValidation.list), promotionController.list);
router.get('/by-code/:code', validate(promotionValidation.byCodeParams), promotionController.getByCode);
router.get('/:id', validate(promotionValidation.getById), promotionController.getById);

router.post('/', requireRole('OWNER', 'MANAGER'), validate(promotionValidation.create), promotionController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(promotionValidation.update), promotionController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(promotionValidation.deactivate), promotionController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(promotionValidation.reactivate), promotionController.reactivate);

export default router;
