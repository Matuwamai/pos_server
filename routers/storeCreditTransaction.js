import express from 'express';
import storeCreditTransactionController from '../controllers/storeCreditTransaction.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import storeCreditTransactionValidation from '../validations/storeCreditTransaction.js';

const router = express.Router();

router.use(authenticate);

// No dedicated "get balance" route — Customer.storeCreditBalance is already
// materialized and returned on every GET /api/v1/customers/:id response,
// unlike loyalty points, which have no equivalent column.
router.get('/', validate(storeCreditTransactionValidation.list), storeCreditTransactionController.list);

// Issuing/redeeming credit is a normal till-side action (part of a refund
// or a sale), open to any authenticated role. Manual adjustment is
// corrective and administrative, so it's OWNER/MANAGER only.
router.post('/issue', validate(storeCreditTransactionValidation.issue), storeCreditTransactionController.issue);
router.post('/redeem', validate(storeCreditTransactionValidation.redeem), storeCreditTransactionController.redeem);
router.post('/adjust', requireRole('OWNER', 'MANAGER'), validate(storeCreditTransactionValidation.adjust), storeCreditTransactionController.adjust);

export default router;
