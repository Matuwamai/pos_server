import express from 'express';
import smsCampaignController from '../controllers/smsCampaign.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import smsCampaignValidation from '../validations/smsCampaign.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('smsCampaigns.list'), validate(smsCampaignValidation.list), smsCampaignController.list);
router.get('/:id', requirePermission('smsCampaigns.read'), validate(smsCampaignValidation.getById), smsCampaignController.getById);

router.post('/', requirePermission('smsCampaigns.create'), validate(smsCampaignValidation.create), smsCampaignController.create);
router.patch('/:id', requirePermission('smsCampaigns.update'), validate(smsCampaignValidation.update), smsCampaignController.update);
router.post('/:id/cancel', requirePermission('smsCampaigns.cancel'), validate(smsCampaignValidation.cancel), smsCampaignController.cancel);

export default router;
