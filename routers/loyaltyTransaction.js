import express from 'express';
import loyaltyTransactionController from '../controllers/loyaltyTransaction.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import loyaltyTransactionValidation from '../validations/loyaltyTransaction.js';

const router = express.Router();

router.use(authenticate);

// Declared before / so it isn't swallowed by anything more general later.
router.get('/balance/:customerId', requirePermission('loyaltyTransactions.balance'), validate(loyaltyTransactionValidation.balanceParams), loyaltyTransactionController.getBalance);
router.get('/', requirePermission('loyaltyTransactions.list'), validate(loyaltyTransactionValidation.list), loyaltyTransactionController.list);

router.post('/earn', requirePermission('loyaltyTransactions.earn'), validate(loyaltyTransactionValidation.earn), loyaltyTransactionController.earn);
router.post('/redeem', requirePermission('loyaltyTransactions.redeem'), validate(loyaltyTransactionValidation.redeem), loyaltyTransactionController.redeem);
router.post('/adjust', requirePermission('loyaltyTransactions.adjust'), validate(loyaltyTransactionValidation.adjust), loyaltyTransactionController.adjust);

export default router;
