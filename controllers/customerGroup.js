import asyncHandler from '../utils/asyncHandler.js';
import customerGroupService from '../services/customerGroup.js';

const create = asyncHandler(async (req, res) => {
  const group = await customerGroupService.createCustomerGroup(req.body);
  res.status(201).json(group);
});

const list = asyncHandler(async (req, res) => {
  const result = await customerGroupService.listCustomerGroups(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const group = await customerGroupService.getCustomerGroupById(req.params.id);
  res.status(200).json(group);
});

const update = asyncHandler(async (req, res) => {
  const group = await customerGroupService.updateCustomerGroup(req.params.id, req.body);
  res.status(200).json(group);
});

const deactivate = asyncHandler(async (req, res) => {
  const group = await customerGroupService.deactivateCustomerGroup(req.params.id);
  res.status(200).json(group);
});

const reactivate = asyncHandler(async (req, res) => {
  const group = await customerGroupService.reactivateCustomerGroup(req.params.id);
  res.status(200).json(group);
});

export default { create, list, getById, update, deactivate, reactivate };
