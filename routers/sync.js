import express from 'express';
import syncController from '../controllers/sync.js';
import { authenticateSyncClient, authenticateTerminal } from '../middlewares/authenticateTerminal.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import syncValidation from '../validations/sync.js';

const router = express.Router();

router.get('/pull', authenticateSyncClient, requirePermission('sync.pull'), validate(syncValidation.pull), syncController.pull);
// Push is device-only: a sale can only be recorded by the till that rang it up.
router.post('/push', authenticateTerminal, requirePermission('sync.push'), validate(syncValidation.push), syncController.push);

export default router;
