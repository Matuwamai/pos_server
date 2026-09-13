import asyncHandler from '../utils/asyncHandler.js';
import taxRateService from '../services/taxRate.js';

const create = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.createTaxRate(req.body);
  res.status(201).json(taxRate);
});

const list = asyncHandler(async (req, res) => {
  const result = await taxRateService.listTaxRates(req.validatedQuery);
  res.status(200).json(result);
});

const getDefault = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.getDefaultTaxRate();
  res.status(200).json(taxRate);
});

const getById = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.getTaxRateById(req.params.id);
  res.status(200).json(taxRate);
});

const update = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.updateTaxRate(req.params.id, req.body);
  res.status(200).json(taxRate);
});

const deactivate = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.deactivateTaxRate(req.params.id);
  res.status(200).json(taxRate);
});

const reactivate = asyncHandler(async (req, res) => {
  const taxRate = await taxRateService.reactivateTaxRate(req.params.id);
  res.status(200).json(taxRate);
});

export default { create, list, getDefault, getById, update, deactivate, reactivate };
