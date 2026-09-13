import express from 'express';
import loyaltyTransactionController from '../controllers/loyaltyTransaction.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import loyaltyTransactionValidation from '../validations/loyaltyTransaction.js';

const router = express.Router();

router.use(authenticate);

// Declared before / so it isn't swallowed by anything more general later.
router.get('/balance/:customerId', validate(loyaltyTransactionValidation.balanceParams), loyaltyTransactionController.getBalance);
router.get('/', validate(loyaltyTransactionValidation.list), loyaltyTransactionController.list);

// Earning/redeeming points is a normal till-side action (part of ringing up
// a sale), open to any authenticated role. Manual adjustment is corrective
// and administrative, so it's OWNER/MANAGER only.
router.post('/earn', validate(loyaltyTransactionValidation.earn), loyaltyTransactionController.earn);
router.post('/redeem', validate(loyaltyTransactionValidation.redeem), loyaltyTransactionController.redeem);
router.post('/adjust', requireRole('OWNER', 'MANAGER'), validate(loyaltyTransactionValidation.adjust), loyaltyTransactionController.adjust);

export default router;
