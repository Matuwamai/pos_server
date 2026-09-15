import asyncHandler from '../utils/asyncHandler.js';
import smsMessageService from '../services/smsMessage.js';

const list = asyncHandler(async (req, res) => {
  const result = await smsMessageService.listSmsMessages(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const message = await smsMessageService.getSmsMessageById(req.params.id);
  res.status(200).json(message);
});

const send = asyncHandler(async (req, res) => {
  const message = await smsMessageService.sendDirectSms(req.user, req.body);
  res.status(201).json(message);
});

export default { list, getById, send };
