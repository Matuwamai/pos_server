import asyncHandler from '../utils/asyncHandler.js';
import productService from '../services/product.js';

const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json(product);
});

const list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  res.status(200).json(product);
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.status(200).json(product);
});

const deactivate = asyncHandler(async (req, res) => {
  const product = await productService.deactivateProduct(req.params.id);
  res.status(200).json(product);
});

const reactivate = asyncHandler(async (req, res) => {
  const product = await productService.reactivateProduct(req.params.id);
  res.status(200).json(product);
});

const attachModifierGroup = asyncHandler(async (req, res) => {
  const product = await productService.attachModifierGroup(req.params.id, req.body.modifierGroupId);
  res.status(200).json(product);
});

const detachModifierGroup = asyncHandler(async (req, res) => {
  const product = await productService.detachModifierGroup(req.params.id, req.params.modifierGroupId);
  res.status(200).json(product);
});

export default { create, list, getById, update, deactivate, reactivate, attachModifierGroup, detachModifierGroup };
