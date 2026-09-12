import asyncHandler from '../utils/asyncHandler.js';
import locationService from '../services/location.js';

const create = asyncHandler(async (req, res) => {
  const location = await locationService.createLocation(req.planCode, req.body);
  res.status(201).json(location);
});

const list = asyncHandler(async (req, res) => {
  const locations = await locationService.listLocations();
  res.status(200).json(locations);
});

const getById = asyncHandler(async (req, res) => {
  const location = await locationService.getLocationById(req.params.id);
  res.status(200).json(location);
});

const update = asyncHandler(async (req, res) => {
  const location = await locationService.updateLocation(req.params.id, req.body);
  res.status(200).json(location);
});

const deactivate = asyncHandler(async (req, res) => {
  const location = await locationService.deactivateLocation(req.params.id);
  res.status(200).json(location);
});

const reactivate = asyncHandler(async (req, res) => {
  const location = await locationService.reactivateLocation(req.params.id);
  res.status(200).json(location);
});

export default { create, list, getById, update, deactivate, reactivate };
