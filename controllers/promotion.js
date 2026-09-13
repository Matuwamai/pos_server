import asyncHandler from '../utils/asyncHandler.js';
import promotionService from '../services/promotion.js';

const create = asyncHandler(async (req, res) => {
  const promotion = await promotionService.createPromotion(req.body);
  res.status(201).json(promotion);
});

const list = asyncHandler(async (req, res) => {
  const result = await promotionService.listPromotions(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const promotion = await promotionService.getPromotionById(req.params.id);
  res.status(200).json(promotion);
});

const update = asyncHandler(async (req, res) => {
  const promotion = await promotionService.updatePromotion(req.params.id, req.body);
  res.status(200).json(promotion);
});

const deactivate = asyncHandler(async (req, res) => {
  const promotion = await promotionService.deactivatePromotion(req.params.id);
  res.status(200).json(promotion);
});

const reactivate = asyncHandler(async (req, res) => {
  const promotion = await promotionService.reactivatePromotion(req.params.id);
  res.status(200).json(promotion);
});

const getByCode = asyncHandler(async (req, res) => {
  const promotion = await promotionService.getValidPromotionByCode(req.params.code);
  res.status(200).json(promotion);
});

export default { create, list, getById, update, deactivate, reactivate, getByCode };
