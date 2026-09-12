import asyncHandler from '../utils/asyncHandler.js';
import supplierService from '../services/supplier.js';

const create = asyncHandler(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.body);
  res.status(201).json(supplier);
});

const list = asyncHandler(async (req, res) => {
  const result = await supplierService.listSuppliers(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const supplier = await supplierService.getSupplierById(req.params.id);
  res.status(200).json(supplier);
});

const update = asyncHandler(async (req, res) => {
  const supplier = await supplierService.updateSupplier(req.params.id, req.body);
  res.status(200).json(supplier);
});

const deactivate = asyncHandler(async (req, res) => {
  const supplier = await supplierService.deactivateSupplier(req.params.id);
  res.status(200).json(supplier);
});

const reactivate = asyncHandler(async (req, res) => {
  const supplier = await supplierService.reactivateSupplier(req.params.id);
  res.status(200).json(supplier);
});

export default { create, list, getById, update, deactivate, reactivate };
