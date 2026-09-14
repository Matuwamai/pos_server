import asyncHandler from '../utils/asyncHandler.js';
import employeeShiftService from '../services/employeeShift.js';

const clockIn = asyncHandler(async (req, res) => {
  const shift = await employeeShiftService.clockIn(req.user, req.body);
  res.status(201).json(shift);
});

const clockOut = asyncHandler(async (req, res) => {
  const shift = await employeeShiftService.clockOut(req.params.id, req.user, req.permissions, req.body);
  res.status(200).json(shift);
});

const getActive = asyncHandler(async (req, res) => {
  const shift = await employeeShiftService.getActiveShift(req.user);
  res.status(200).json(shift);
});

const getById = asyncHandler(async (req, res) => {
  const shift = await employeeShiftService.getShiftById(req.params.id, req.user, req.permissions);
  res.status(200).json(shift);
});

const list = asyncHandler(async (req, res) => {
  const result = await employeeShiftService.listShifts(req.validatedQuery, req.user, req.permissions);
  res.status(200).json(result);
});

export default { clockIn, clockOut, getActive, getById, list };
