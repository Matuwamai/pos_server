import express from 'express';
import storeCreditTransactionController from '../controllers/storeCreditTransaction.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import storeCreditTransactionValidation from '../validations/storeCreditTransaction.js';

const router = express.Router();

router.use(authenticate);

// No dedicated "get balance" route — Customer.storeCreditBalance is already
// materialized and returned on every GET /api/v1/customers/:id response,
// unlike loyalty points, which have no equivalent column.
router.get('/', requirePermission('storeCreditTransactions.list'), validate(storeCreditTransactionValidation.list), storeCreditTransactionController.list);

router.post('/issue', requirePermission('storeCreditTransactions.issue'), validate(storeCreditTransactionValidation.issue), storeCreditTransactionController.issue);
router.post('/redeem', requirePermission('storeCreditTransactions.redeem'), validate(storeCreditTransactionValidation.redeem), storeCreditTransactionController.redeem);
router.post('/adjust', requirePermission('storeCreditTransactions.adjust'), validate(storeCreditTransactionValidation.adjust), storeCreditTransactionController.adjust);

export default router;
