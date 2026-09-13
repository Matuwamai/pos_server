import asyncHandler from '../utils/asyncHandler.js';
import inventoryService from '../services/inventory.js';

const list = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventory(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const item = await inventoryService.getInventoryItemById(req.params.id);
  res.status(200).json(item);
});

const update = asyncHandler(async (req, res) => {
  const item = await inventoryService.updateLowStockThreshold(req.params.id, req.body.lowStockThreshold);
  res.status(200).json(item);
});

const adjust = asyncHandler(async (req, res) => {
  const item = await inventoryService.adjustInventory(req.body);
  res.status(200).json(item);
});

const listLogs = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventoryLogs(req.validatedQuery);
  res.status(200).json(result);
});

export default { list, getById, update, adjust, listLogs };
