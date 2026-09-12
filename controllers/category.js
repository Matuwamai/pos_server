import asyncHandler from '../utils/asyncHandler.js';
import categoryService from '../services/category.js';

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  res.status(201).json(category);
});

const list = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  res.status(200).json(category);
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  res.status(200).json(category);
});

const deactivate = asyncHandler(async (req, res) => {
  const category = await categoryService.deactivateCategory(req.params.id);
  res.status(200).json(category);
});

const reactivate = asyncHandler(async (req, res) => {
  const category = await categoryService.reactivateCategory(req.params.id);
  res.status(200).json(category);
});

export default { create, list, getById, update, deactivate, reactivate };
