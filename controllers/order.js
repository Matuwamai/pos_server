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
  // req.user is null for a device (terminal) token — the signed-in cashier's id
  // comes from the body instead (see services/order.js's refundOrder, which
  // validates it regardless of where it came from).
  const actingUser = req.user ?? { id: req.body.processedByUserId };
  const order = await orderService.refundOrder(req.params.id, actingUser, req.body);
  res.status(201).json(order);
});

export default { create, list, getById, refund };
