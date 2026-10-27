import express from 'express';
import authController from '../controllers/auth.js';
import validate from '../middlewares/validate.js';
import authValidation from '../validations/auth.js';
import { loginLimiter, recoveryLimiter, signupLimiter } from '../middlewares/authRateLimit.js';

const router = express.Router();

// Public: self-registration creates the tenant + owner user + default
// location together (see auth.service.js signup for why this exists
// separately from admin-driven POST /api/v1/tenants).
router.post('/signup', signupLimiter, validate(authValidation.signup), authController.signup);
router.post('/login', loginLimiter, validate(authValidation.login), authController.login);

// Second step of MFA — POST /login returns { mfaRequired: true, mfaToken }
// instead of a real session token when the user has MFA enabled; the
// client submits the code it received via SMS against that token here.
router.post('/verify-otp', loginLimiter, validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/resend-otp', loginLimiter, validate(authValidation.resendOtp), authController.resendOtp);

// Self-service password recovery — public, so both are throttled per IP.
// forgot-password answers identically for unknown accounts (no enumeration);
// reset-password verifies the emailed/texted code with a capped number of
// guesses per issued code.
router.post('/forgot-password', recoveryLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', recoveryLimiter, validate(authValidation.resetPassword), authController.resetPassword);

export default router;
