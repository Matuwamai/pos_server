
import asyncHandler from '../utils/asyncHandler.js';
import tenantService from '../services/tenant.js';
import logger from '../config/logger.js';
 
const create = asyncHandler(async (req, res) => {
  const tenant = await tenantService.createTenant(req.body);
  logger.info('Tenant created', { tenantId: tenant.id, subdomain: tenant.subdomain });
  res.status(201).json(tenant);
});
 
const list = asyncHandler(async (req, res) => {
  const result = await tenantService.listTenants(req.query);
  res.status(200).json(result);
});
 
const getById = asyncHandler(async (req, res) => {
  const tenant = await tenantService.getTenantById(req.params.id);
  res.status(200).json(tenant);
});
 
const update = asyncHandler(async (req, res) => {
  const tenant = await tenantService.updateTenant(req.params.id, req.body);
  res.status(200).json(tenant);
});
 
const suspend = asyncHandler(async (req, res) => {
  const tenant = await tenantService.suspendTenant(req.params.id, req.body.reason);
  logger.warn('Tenant suspended', {
    tenantId: tenant.id,
    reason: req.body.reason || null,
    actorUserId: req.user ? req.user.id : null,
  });
  res.status(200).json(tenant);
});
 
const reactivate = asyncHandler(async (req, res) => {
  const tenant = await tenantService.reactivateTenant(req.params.id);
  logger.info('Tenant reactivated', {
    tenantId: tenant.id,
    actorUserId: req.user ? req.user.id : null,
  });
  res.status(200).json(tenant);
});
 
const cancel = asyncHandler(async (req, res) => {
  const tenant = await tenantService.cancelTenant(req.params.id, req.body.reason);
  logger.warn('Tenant cancelled', {
    tenantId: tenant.id,
    reason: req.body.reason || null,
    actorUserId: req.user ? req.user.id : null,
  });
  res.status(200).json(tenant);
});
 
export default { create, list, getById, update, suspend, reactivate, cancel };