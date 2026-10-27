import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import syncService from '../services/sync.js';
import offlineSyncService from '../services/offlineSync.js';
import prisma from '../config/prismaClient.js';

const pull = asyncHandler(async (req, res) => {
  const locationId = req.isTerminal ? req.terminal.locationId : req.validatedQuery.locationId;
  if (!locationId) throw ApiError.badRequest('locationId is required');
  const result = await syncService.pullChanges({ ...req.validatedQuery, locationId });
  res.status(200).json(result);
});

// Pushes come only from a device, so every op is attributed to that terminal.
const push = asyncHandler(async (req, res) => {
  const terminal = await prisma.terminal.findUnique({ where: { id: req.terminal.id } });
  const results = await offlineSyncService.pushOps(terminal, req.body.ops);
  res.status(200).json({ results });
});

export default { pull, push };
