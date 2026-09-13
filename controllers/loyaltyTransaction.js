import asyncHandler from '../utils/asyncHandler.js';
import loyaltyTransactionService from '../services/loyaltyTransaction.js';

const earn = asyncHandler(async (req, res) => {
  const txn = await loyaltyTransactionService.earnPoints(req.body);
  res.status(201).json(txn);
});

const redeem = asyncHandler(async (req, res) => {
  const txn = await loyaltyTransactionService.redeemPoints(req.body);
  res.status(201).json(txn);
});

const adjust = asyncHandler(async (req, res) => {
  const txn = await loyaltyTransactionService.adjustPoints(req.body, req.user);
  res.status(201).json(txn);
});

const list = asyncHandler(async (req, res) => {
  const result = await loyaltyTransactionService.listTransactions(req.validatedQuery);
  res.status(200).json(result);
});

const getBalance = asyncHandler(async (req, res) => {
  const balance = await loyaltyTransactionService.getPointsBalance(req.params.customerId);
  res.status(200).json({ customerId: req.params.customerId, balance });
});

export default { earn, redeem, adjust, list, getBalance };
