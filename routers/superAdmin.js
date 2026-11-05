import express from 'express';
import superAdminController from '../controllers/superAdmin.js';
import requireSuperAdmin from '../middlewares/requireSuperAdmin.js';
import validate from '../middlewares/validate.js';
import superAdminValidation from '../validations/superAdmin.js';
 
const router = express.Router();
 
router.post('/login', validate(superAdminValidation.login), superAdminController.login);

router.post('/', requireSuperAdmin, validate(superAdminValidation.create), superAdminController.create);
 
export default router;
 