import asyncHandler from '../utils/asyncHandler.js';
import orderService from '../services/order.js';

const create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user, req.body);
  res.status(201).json(order);
});

const list = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  res.status(200).json(order);
});

const refund = asyncHandler(async (req, res) => {
  const order = await orderService.refundOrder(req.params.id, req.user, req.body);
  res.status(201).json(order);
});

export default { create, list, getById, refund };
