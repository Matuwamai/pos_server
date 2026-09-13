import express from 'express';
import loyaltyProgramController from '../controllers/loyaltyProgram.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import loyaltyProgramValidation from '../validations/loyaltyProgram.js';

const router = express.Router();

router.use(authenticate);

router.get('/', loyaltyProgramController.getProgram);
router.post('/', requireRole('OWNER', 'MANAGER'), validate(loyaltyProgramValidation.create), loyaltyProgramController.create);
router.patch('/', requireRole('OWNER', 'MANAGER'), validate(loyaltyProgramValidation.update), loyaltyProgramController.update);

export default router;
