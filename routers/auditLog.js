import express from 'express';
import auditLogController from '../controllers/auditLog.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import auditLogValidation from '../validations/auditLog.js';

const router = express.Router();

router.use(authenticate);

// Read-only — entries are written internally by other services, never
// created directly through the API.
router.get('/', requirePermission('auditLogs.list'), validate(auditLogValidation.list), auditLogController.list);

export default router;
