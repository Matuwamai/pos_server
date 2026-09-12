import express from 'express';
import superAdminController from '../controllers/superAdmin.js';
import requireSuperAdmin from '../middlewares/requireSuperAdmin.js';
import validate from '../middlewares/validate.js';
import superAdminValidation from '../validations/superAdmin.js';
 
const router = express.Router();
 
// Public: the only way in without already holding a super-admin token.
router.post('/login', validate(superAdminValidation.login), superAdminController.login);
 
// Protected: only an existing super admin can create another one.
router.post('/', requireSuperAdmin, validate(superAdminValidation.create), superAdminController.create);
 
export default router;
 