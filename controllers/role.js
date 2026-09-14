import asyncHandler from '../utils/asyncHandler.js';
import roleService from '../services/role.js';

const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body);
  res.status(201).json(role);
});

const list = asyncHandler(async (req, res) => {
  const result = await roleService.listRoles(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(req.params.id);
  res.status(200).json(role);
});

const update = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.body);
  res.status(200).json(role);
});

const deactivate = asyncHandler(async (req, res) => {
  const role = await roleService.deactivateRole(req.params.id);
  res.status(200).json(role);
});

const reactivate = asyncHandler(async (req, res) => {
  const role = await roleService.reactivateRole(req.params.id);
  res.status(200).json(role);
});

export default { create, list, getById, update, deactivate, reactivate };
