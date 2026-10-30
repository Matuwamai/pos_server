import asyncHandler from '../utils/asyncHandler.js';
import tenantSelfService from '../services/tenantSelf.js';
import ApiError from '../utils/ApiError.js';

const getMine = asyncHandler(async (req, res) => {
  const tenant = await tenantSelfService.getMyTenant(req.tenantId);
  res.status(200).json(tenant);
});

const updateLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A logo file is required');
  const tenant = await tenantSelfService.updateTenantLogo(req.tenantId, req.file);
  res.status(200).json(tenant);
});

const removeLogo = asyncHandler(async (req, res) => {
  const tenant = await tenantSelfService.removeTenantLogo(req.tenantId);
  res.status(200).json(tenant);
});

const updatePayments = asyncHandler(async (req, res) => {
  const tenant = await tenantSelfService.updateTenantPayments(req.tenantId, req.body);
  res.status(200).json(tenant);
});

const updateMpesaCredential = asyncHandler(async (req, res) => {
  const tenant = await tenantSelfService.updateMpesaCredential(req.tenantId, req.body);
  res.status(200).json(tenant);
});

const removeMpesaCredential = asyncHandler(async (req, res) => {
  const tenant = await tenantSelfService.removeMpesaCredential(req.tenantId);
  res.status(200).json(tenant);
});

export default { getMine, updateLogo, removeLogo, updatePayments, updateMpesaCredential, removeMpesaCredential };
