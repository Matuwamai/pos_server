import asyncHandler from '../utils/asyncHandler.js';
import terminalService from '../services/terminal.js';

const create = asyncHandler(async (req, res) => {
  const terminal = await terminalService.createTerminal(req.body);
  res.status(201).json(terminal);
});

const list = asyncHandler(async (req, res) => {
  const terminals = await terminalService.listTerminals(req.validatedQuery.locationId);
  res.status(200).json(terminals);
});

const getById = asyncHandler(async (req, res) => {
  const terminal = await terminalService.getTerminalById(req.params.id);
  res.status(200).json(terminal);
});

const update = asyncHandler(async (req, res) => {
  const terminal = await terminalService.updateTerminal(req.params.id, req.body);
  res.status(200).json(terminal);
});

const deactivate = asyncHandler(async (req, res) => {
  const terminal = await terminalService.deactivateTerminal(req.params.id);
  res.status(200).json(terminal);
});

const reactivate = asyncHandler(async (req, res) => {
  const terminal = await terminalService.reactivateTerminal(req.params.id);
  res.status(200).json(terminal);
});

const heartbeat = asyncHandler(async (req, res) => {
  const terminal = await terminalService.heartbeat(req.params.id);
  res.status(200).json(terminal);
});

export default { create, list, getById, update, deactivate, reactivate, heartbeat };
