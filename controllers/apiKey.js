import asyncHandler from '../utils/asyncHandler.js';
import apiKeyService from '../services/apiKey.js';

const create = asyncHandler(async (req, res) => {
  const apiKey = await apiKeyService.createApiKey(req.user, req.permissions, req.body);
  res.status(201).json(apiKey);
});

const list = asyncHandler(async (req, res) => {
  const apiKeys = await apiKeyService.listApiKeys();
  res.status(200).json(apiKeys);
});

const revoke = asyncHandler(async (req, res) => {
  const apiKey = await apiKeyService.revokeApiKey(req.params.id);
  res.status(200).json(apiKey);
});

export default { create, list, revoke };
