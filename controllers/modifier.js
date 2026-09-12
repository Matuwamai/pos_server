import asyncHandler from '../utils/asyncHandler.js';
import modifierService from '../services/modifier.js';

const create = asyncHandler(async (req, res) => {
  const modifier = await modifierService.createModifier(req.params.modifierGroupId, req.body);
  res.status(201).json(modifier);
});

const list = asyncHandler(async (req, res) => {
  const modifiers = await modifierService.listModifiers(req.params.modifierGroupId);
  res.status(200).json(modifiers);
});

const getById = asyncHandler(async (req, res) => {
  const modifier = await modifierService.getModifierById(req.params.modifierGroupId, req.params.id);
  res.status(200).json(modifier);
});

const update = asyncHandler(async (req, res) => {
  const modifier = await modifierService.updateModifier(req.params.modifierGroupId, req.params.id, req.body);
  res.status(200).json(modifier);
});

const deactivate = asyncHandler(async (req, res) => {
  const modifier = await modifierService.deactivateModifier(req.params.modifierGroupId, req.params.id);
  res.status(200).json(modifier);
});

const reactivate = asyncHandler(async (req, res) => {
  const modifier = await modifierService.reactivateModifier(req.params.modifierGroupId, req.params.id);
  res.status(200).json(modifier);
});

export default { create, list, getById, update, deactivate, reactivate };
