import asyncHandler from '../utils/asyncHandler.js';
import productVariantService from '../services/productVariant.js';

const addVariant = asyncHandler(async (req, res) => {
  const variant = await productVariantService.addVariant(req.params.productId, req.body);
  res.status(201).json(variant);
});

const getById = asyncHandler(async (req, res) => {
  const variant = await productVariantService.getVariantById(req.params.productId, req.params.variantId);
  res.status(200).json(variant);
});

const update = asyncHandler(async (req, res) => {
  const variant = await productVariantService.updateVariant(req.params.productId, req.params.variantId, req.body);
  res.status(200).json(variant);
});

const deactivate = asyncHandler(async (req, res) => {
  const variant = await productVariantService.deactivateVariant(req.params.productId, req.params.variantId);
  res.status(200).json(variant);
});

const reactivate = asyncHandler(async (req, res) => {
  const variant = await productVariantService.reactivateVariant(req.params.productId, req.params.variantId);
  res.status(200).json(variant);
});

const listComponents = asyncHandler(async (req, res) => {
  const components = await productVariantService.listComponents(req.params.productId, req.params.variantId);
  res.status(200).json(components);
});

const addComponent = asyncHandler(async (req, res) => {
  const component = await productVariantService.addComponent(req.params.productId, req.params.variantId, req.body);
  res.status(201).json(component);
});

const removeComponent = asyncHandler(async (req, res) => {
  await productVariantService.removeComponent(req.params.productId, req.params.variantId, req.params.componentId);
  res.status(204).send();
});

export default { addVariant, getById, update, deactivate, reactivate, listComponents, addComponent, removeComponent };
