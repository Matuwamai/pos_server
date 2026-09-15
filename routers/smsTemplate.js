import express from 'express';
import smsTemplateController from '../controllers/smsTemplate.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import smsTemplateValidation from '../validations/smsTemplate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('smsTemplates.list'), validate(smsTemplateValidation.list), smsTemplateController.list);
router.get('/:id', requirePermission('smsTemplates.read'), validate(smsTemplateValidation.getById), smsTemplateController.getById);

router.post('/', requirePermission('smsTemplates.create'), validate(smsTemplateValidation.create), smsTemplateController.create);
router.patch('/:id', requirePermission('smsTemplates.update'), validate(smsTemplateValidation.update), smsTemplateController.update);
router.post('/:id/deactivate', requirePermission('smsTemplates.deactivate'), validate(smsTemplateValidation.deactivate), smsTemplateController.deactivate);
router.post('/:id/reactivate', requirePermission('smsTemplates.reactivate'), validate(smsTemplateValidation.reactivate), smsTemplateController.reactivate);

export default router;
