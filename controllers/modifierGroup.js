import asyncHandler from '../utils/asyncHandler.js';
import modifierGroupService from '../services/modifierGroup.js';

const create = asyncHandler(async (req, res) => {
  const group = await modifierGroupService.createModifierGroup(req.body);
  res.status(201).json(group);
});

const list = asyncHandler(async (req, res) => {
  const result = await modifierGroupService.listModifierGroups(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const group = await modifierGroupService.getModifierGroupById(req.params.id);
  res.status(200).json(group);
});

const update = asyncHandler(async (req, res) => {
  const group = await modifierGroupService.updateModifierGroup(req.params.id, req.body);
  res.status(200).json(group);
});

const deactivate = asyncHandler(async (req, res) => {
  const group = await modifierGroupService.deactivateModifierGroup(req.params.id);
  res.status(200).json(group);
});

const reactivate = asyncHandler(async (req, res) => {
  const group = await modifierGroupService.reactivateModifierGroup(req.params.id);
  res.status(200).json(group);
});

export default { create, list, getById, update, deactivate, reactivate };
