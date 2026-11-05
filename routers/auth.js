import express from 'express';
import authController from '../controllers/auth.js';
import validate from '../middlewares/validate.js';
import authValidation from '../validations/auth.js';
import { loginLimiter, recoveryLimiter, signupLimiter } from '../middlewares/authRateLimit.js';

const router = express.Router();

router.post('/signup', signupLimiter, validate(authValidation.signup), authController.signup);
router.post('/login', loginLimiter, validate(authValidation.login), authController.login);

router.post('/verify-otp', loginLimiter, validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/resend-otp', loginLimiter, validate(authValidation.resendOtp), authController.resendOtp);

router.post('/forgot-password', recoveryLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', recoveryLimiter, validate(authValidation.resetPassword), authController.resetPassword);

export default router;
