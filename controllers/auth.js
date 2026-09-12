import asyncHandler from '../utils/asyncHandler.js';
import authService from '../services/auth.js';
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

export default { signup, login };
