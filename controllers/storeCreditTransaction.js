import asyncHandler from '../utils/asyncHandler.js';
import storeCreditTransactionService from '../services/storeCreditTransaction.js';

const issue = asyncHandler(async (req, res) => {
  const txn = await storeCreditTransactionService.issueCredit(req.body);
  res.status(201).json(txn);
});

const redeem = asyncHandler(async (req, res) => {
  const txn = await storeCreditTransactionService.redeemCredit(req.body);
  res.status(201).json(txn);
});

const adjust = asyncHandler(async (req, res) => {
  const txn = await storeCreditTransactionService.adjustCredit(req.body, req.user);
  res.status(201).json(txn);
});

const list = asyncHandler(async (req, res) => {
  const result = await storeCreditTransactionService.listTransactions(req.validatedQuery);
  res.status(200).json(result);
});

export default { issue, redeem, adjust, list };
