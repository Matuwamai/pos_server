import asyncHandler from '../utils/asyncHandler.js';
import paymentService from '../services/payment.js';

const list = asyncHandler(async (req, res) => {
  const result = await paymentService.listPayments(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  res.status(200).json(payment);
});

const updateStatus = asyncHandler(async (req, res) => {
  const payment = await paymentService.updatePaymentStatus(req.params.id, req.body, req.user);
  res.status(200).json(payment);
});

export default { list, getById, updateStatus };
