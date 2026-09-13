import asyncHandler from '../utils/asyncHandler.js';
import loyaltyProgramService from '../services/loyaltyProgram.js';

const create = asyncHandler(async (req, res) => {
  const program = await loyaltyProgramService.createLoyaltyProgram(req.body);
  res.status(201).json(program);
});

const getProgram = asyncHandler(async (req, res) => {
  const program = await loyaltyProgramService.getLoyaltyProgram();
  res.status(200).json(program);
});

const update = asyncHandler(async (req, res) => {
  const program = await loyaltyProgramService.updateLoyaltyProgram(req.body);
  res.status(200).json(program);
});

export default { create, getProgram, update };
