import express from 'express';
import loyaltyProgramController from '../controllers/loyaltyProgram.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import loyaltyProgramValidation from '../validations/loyaltyProgram.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('loyaltyProgram.read'), loyaltyProgramController.getProgram);
router.post('/', requirePermission('loyaltyProgram.create'), validate(loyaltyProgramValidation.create), loyaltyProgramController.create);
router.patch('/', requirePermission('loyaltyProgram.update'), validate(loyaltyProgramValidation.update), loyaltyProgramController.update);

export default router;
