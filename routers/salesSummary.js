import express from 'express';
import salesSummaryController from '../controllers/salesSummary.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import salesSummaryValidation from '../validations/salesSummary.js';

const router = express.Router();

router.use(authenticate);

// Read-only — rows are written internally by order.service.js, never
// created or edited through the API.
router.get('/totals', requirePermission('salesSummary.totals'), validate(salesSummaryValidation.totals), salesSummaryController.totals);
router.get('/', requirePermission('salesSummary.list'), validate(salesSummaryValidation.list), salesSummaryController.list);

export default router;
