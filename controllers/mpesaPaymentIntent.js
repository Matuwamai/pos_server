import asyncHandler from '../utils/asyncHandler.js';
import mpesaPaymentIntentService from '../services/mpesaPaymentIntent.js';

const create = asyncHandler(async (req, res) => {
  const intent = await mpesaPaymentIntentService.createIntent(req.tenantId, {
    ...req.body,
    terminalId: req.terminal?.id ?? null,
    locationId: req.terminal?.locationId ?? null,
    initiatedByUserId: req.user?.id ?? null,
  });
  res.status(201).json({ id: intent.id, status: intent.status });
});

const getById = asyncHandler(async (req, res) => {
  const result = await mpesaPaymentIntentService.getIntentStatus(req.tenantId, req.params.id);
  res.status(200).json(result);
});

export default { create, getById };
