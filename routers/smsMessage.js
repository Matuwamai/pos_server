import express from 'express';
import smsMessageController from '../controllers/smsMessage.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import smsMessageValidation from '../validations/smsMessage.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('smsMessages.list'), validate(smsMessageValidation.list), smsMessageController.list);
router.get('/:id', requirePermission('smsMessages.read'), validate(smsMessageValidation.getById), smsMessageController.getById);
router.post('/send', requirePermission('smsMessages.send'), validate(smsMessageValidation.send), smsMessageController.send);

export default router;
