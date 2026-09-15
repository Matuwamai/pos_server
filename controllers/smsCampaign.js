import asyncHandler from '../utils/asyncHandler.js';
import smsCampaignService from '../services/smsCampaign.js';

const create = asyncHandler(async (req, res) => {
  const campaign = await smsCampaignService.createCampaign(req.user, req.body);
  res.status(201).json(campaign);
});

const list = asyncHandler(async (req, res) => {
  const result = await smsCampaignService.listCampaigns(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const campaign = await smsCampaignService.getCampaignById(req.params.id);
  res.status(200).json(campaign);
});

const update = asyncHandler(async (req, res) => {
  const campaign = await smsCampaignService.updateCampaign(req.params.id, req.body);
  res.status(200).json(campaign);
});

const cancel = asyncHandler(async (req, res) => {
  const campaign = await smsCampaignService.cancelCampaign(req.params.id);
  res.status(200).json(campaign);
});

export default { create, list, getById, update, cancel };
