import express from 'express';
import giftCardController from '../controllers/giftCard.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import giftCardValidation from '../validations/giftCard.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(giftCardValidation.list), giftCardController.list);
router.get('/:id', validate(giftCardValidation.getById), giftCardController.getById);
router.get('/:id/transactions', validate(giftCardValidation.listTransactions), giftCardController.listTransactions);

// Issuing/redeeming/reloading are normal till-side actions (selling a card,
// taking one as payment, topping one up) — open to any authenticated role.
router.post('/', validate(giftCardValidation.issue), giftCardController.issue);
router.post('/redeem', validate(giftCardValidation.redeem), giftCardController.redeem);
router.post('/reload', validate(giftCardValidation.reload), giftCardController.reload);

// Corrective/administrative actions are OWNER/MANAGER only.
router.post('/:id/adjust', requireRole('OWNER', 'MANAGER'), validate(giftCardValidation.adjust), giftCardController.adjust);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(giftCardValidation.deactivate), giftCardController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(giftCardValidation.reactivate), giftCardController.reactivate);

export default router;
