import asyncHandler from '../utils/asyncHandler.js';
import stockTransferService from '../services/stockTransfer.js';

const create = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.createStockTransfer(req.user.id, req.body);
  res.status(201).json(transfer);
});

const list = asyncHandler(async (req, res) => {
  const result = await stockTransferService.listStockTransfers(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.getStockTransferById(req.params.id);
  res.status(200).json(transfer);
});

const markInTransit = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.markInTransit(req.params.id);
  res.status(200).json(transfer);
});

const complete = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.completeTransfer(req.params.id);
  res.status(200).json(transfer);
});

const cancel = asyncHandler(async (req, res) => {
  const transfer = await stockTransferService.cancelStockTransfer(req.params.id);
  res.status(200).json(transfer);
});

export default { create, list, getById, markInTransit, complete, cancel };
