import asyncHandler from '../utils/asyncHandler.js';
import smsTemplateService from '../services/smsTemplate.js';

const create = asyncHandler(async (req, res) => {
  const template = await smsTemplateService.createSmsTemplate(req.body);
  res.status(201).json(template);
});

const list = asyncHandler(async (req, res) => {
  const result = await smsTemplateService.listSmsTemplates(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const template = await smsTemplateService.getSmsTemplateById(req.params.id);
  res.status(200).json(template);
});

const update = asyncHandler(async (req, res) => {
  const template = await smsTemplateService.updateSmsTemplate(req.params.id, req.body);
  res.status(200).json(template);
});

const deactivate = asyncHandler(async (req, res) => {
  const template = await smsTemplateService.deactivateSmsTemplate(req.params.id);
  res.status(200).json(template);
});

const reactivate = asyncHandler(async (req, res) => {
  const template = await smsTemplateService.reactivateSmsTemplate(req.params.id);
  res.status(200).json(template);
});

export default { create, list, getById, update, deactivate, reactivate };
