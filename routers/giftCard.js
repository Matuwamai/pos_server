import express from 'express';
import giftCardController from '../controllers/giftCard.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import giftCardValidation from '../validations/giftCard.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('giftCards.list'), validate(giftCardValidation.list), giftCardController.list);
router.get('/:id', requirePermission('giftCards.read'), validate(giftCardValidation.getById), giftCardController.getById);
router.get('/:id/transactions', requirePermission('giftCards.transactions.list'), validate(giftCardValidation.listTransactions), giftCardController.listTransactions);

router.post('/', requirePermission('giftCards.create'), validate(giftCardValidation.issue), giftCardController.issue);
router.post('/redeem', requirePermission('giftCards.redeem'), validate(giftCardValidation.redeem), giftCardController.redeem);
router.post('/reload', requirePermission('giftCards.reload'), validate(giftCardValidation.reload), giftCardController.reload);

router.post('/:id/adjust', requirePermission('giftCards.adjust'), validate(giftCardValidation.adjust), giftCardController.adjust);
router.post('/:id/deactivate', requirePermission('giftCards.deactivate'), validate(giftCardValidation.deactivate), giftCardController.deactivate);
router.post('/:id/reactivate', requirePermission('giftCards.reactivate'), validate(giftCardValidation.reactivate), giftCardController.reactivate);

export default router;
