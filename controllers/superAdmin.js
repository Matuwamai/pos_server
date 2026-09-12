import asyncHandler from '../utils/asyncHandler.js';
import superAdminService from '../services/superAdmin.js';
 
const login = asyncHandler(async (req, res) => {
  const result = await superAdminService.login(req.body);
  res.status(200).json(result);
});
 
const create = asyncHandler(async (req, res) => {
  const admin = await superAdminService.createSuperAdmin(req.body);
  res.status(201).json(admin);
});
 
export default { login, create };