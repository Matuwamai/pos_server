import asyncHandler from '../utils/asyncHandler.js';
import purchaseOrderService from '../services/purchaseOrder.js';

const create = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.createPurchaseOrder(req.user.id, req.body);
  res.status(201).json(po);
});

const list = asyncHandler(async (req, res) => {
  const result = await purchaseOrderService.listPurchaseOrders(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.getPurchaseOrderById(req.params.id);
  res.status(200).json(po);
});

const update = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.updatePurchaseOrder(req.params.id, req.body);
  res.status(200).json(po);
});

const markOrdered = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.markOrdered(req.params.id);
  res.status(200).json(po);
});

const receive = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.receiveItems(req.params.id, req.body.items);
  res.status(200).json(po);
});

const cancel = asyncHandler(async (req, res) => {
  const po = await purchaseOrderService.cancelPurchaseOrder(req.params.id);
  res.status(200).json(po);
});

export default { create, list, getById, update, markOrdered, receive, cancel };
