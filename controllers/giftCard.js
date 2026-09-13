import asyncHandler from '../utils/asyncHandler.js';
import giftCardService from '../services/giftCard.js';

const issue = asyncHandler(async (req, res) => {
  const giftCard = await giftCardService.issueGiftCard(req.body);
  res.status(201).json(giftCard);
});

const list = asyncHandler(async (req, res) => {
  const result = await giftCardService.listGiftCards(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const giftCard = await giftCardService.getGiftCardById(req.params.id);
  res.status(200).json(giftCard);
});

const redeem = asyncHandler(async (req, res) => {
  const txn = await giftCardService.redeemGiftCard(req.body);
  res.status(201).json(txn);
});

const reload = asyncHandler(async (req, res) => {
  const txn = await giftCardService.reloadGiftCard(req.body);
  res.status(201).json(txn);
});

const adjust = asyncHandler(async (req, res) => {
  const txn = await giftCardService.adjustGiftCard(req.params.id, req.body.amount, req.user);
  res.status(201).json(txn);
});

const deactivate = asyncHandler(async (req, res) => {
  const giftCard = await giftCardService.deactivateGiftCard(req.params.id);
  res.status(200).json(giftCard);
});

const reactivate = asyncHandler(async (req, res) => {
  const giftCard = await giftCardService.reactivateGiftCard(req.params.id);
  res.status(200).json(giftCard);
});

const listTransactions = asyncHandler(async (req, res) => {
  const transactions = await giftCardService.listTransactions(req.params.id);
  res.status(200).json(transactions);
});

export default { issue, list, getById, redeem, reload, adjust, deactivate, reactivate, listTransactions };
