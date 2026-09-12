import express from 'express';
import authController from '../controllers/auth.js';
import validate from '../middlewares/validate.js';
import authValidation from '../validations/auth.js';

const router = express.Router();

// Public: self-registration creates the tenant + owner user + default
// location together (see auth.service.js signup for why this exists
// separately from admin-driven POST /api/v1/tenants).
router.post('/signup', validate(authValidation.signup), authController.signup);
router.post('/login', validate(authValidation.login), authController.login);

export default router;
