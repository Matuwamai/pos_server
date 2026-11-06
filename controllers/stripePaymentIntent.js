import asyncHandler from '../utils/asyncHandler.js';
import stripePaymentIntentService from '../services/stripePaymentIntent.js';

const create = asyncHandler(async (req, res) => {
  const intent = await stripePaymentIntentService.createIntent(req.tenantId, {
    ...req.body,
    terminalId: req.terminal?.id ?? null,
    locationId: req.terminal?.locationId ?? null,
    initiatedByUserId: req.user?.id ?? null,
  });
  res.status(201).json(intent);
});

const getById = asyncHandler(async (req, res) => {
  const result = await stripePaymentIntentService.getIntentStatus(req.tenantId, req.params.id);
  res.status(200).json(result);
});

export default { create, getById };
