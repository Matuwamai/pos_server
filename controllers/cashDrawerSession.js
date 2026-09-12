import asyncHandler from '../utils/asyncHandler.js';
import cashDrawerSessionService from '../services/cashDrawerSession.js';

const open = asyncHandler(async (req, res) => {
  const session = await cashDrawerSessionService.openSession(req.body, req.user.id);
  res.status(201).json(session);
});

const list = asyncHandler(async (req, res) => {
  const result = await cashDrawerSessionService.listSessions(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const session = await cashDrawerSessionService.getSessionById(req.params.id);
  res.status(200).json(session);
});

const close = asyncHandler(async (req, res) => {
  const session = await cashDrawerSessionService.closeSession(req.params.id, req.body.closingCash, req.user);
  res.status(200).json(session);
});

export default { open, list, getById, close };
