import asyncHandler from '../utils/asyncHandler.js';
import salesSummaryService from '../services/salesSummary.js';

const list = asyncHandler(async (req, res) => {
  const result = await salesSummaryService.listSummaries(req.validatedQuery);
  res.status(200).json(result);
});

const totals = asyncHandler(async (req, res) => {
  const totals = await salesSummaryService.getTotals(req.validatedQuery);
  res.status(200).json(totals);
});

export default { list, totals };
