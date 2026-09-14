import express from 'express';
import apiKeyController from '../controllers/apiKey.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import apiKeyValidation from '../validations/apiKey.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('apiKeys.list'), apiKeyController.list);
router.post('/', requirePermission('apiKeys.create'), validate(apiKeyValidation.create), apiKeyController.create);
router.post('/:id/revoke', requirePermission('apiKeys.revoke'), validate(apiKeyValidation.revoke), apiKeyController.revoke);

export default router;
