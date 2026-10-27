import asyncHandler from '../utils/asyncHandler.js';
import authService from '../services/auth.js';
import passwordResetService from '../services/passwordReset.js';
import logger from '../config/logger.js';

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);
  logger.info('Tenant self-registered', { tenantId: result.tenant.id, subdomain: result.tenant.subdomain });
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyLoginOtp(req.body);
  res.status(200).json(result);
});

const resendOtp = asyncHandler(async (req, res) => {
  const result = await authService.resendLoginOtp(req.body);
  res.status(200).json(result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  await passwordResetService.requestReset(req.body);
  // Same response whether or not the account exists — see passwordReset.js.
  res.status(200).json({ message: 'If an account matches, a reset code has been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await passwordResetService.confirmReset(req.body);
  res.status(200).json({ message: 'Password updated. You can now sign in.' });
});

export default { signup, login, verifyOtp, resendOtp, forgotPassword, resetPassword };
