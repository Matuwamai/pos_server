import asyncHandler from '../utils/asyncHandler.js';
import customerService from '../services/customer.js';

const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body);
  res.status(201).json(customer);
});

const list = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomers(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id);
  res.status(200).json(customer);
});

const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);
  res.status(200).json(customer);
});

const deactivate = asyncHandler(async (req, res) => {
  const customer = await customerService.deactivateCustomer(req.params.id);
  res.status(200).json(customer);
});

const reactivate = asyncHandler(async (req, res) => {
  const customer = await customerService.reactivateCustomer(req.params.id);
  res.status(200).json(customer);
});

export default { create, list, getById, update, deactivate, reactivate };
