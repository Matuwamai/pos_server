import asyncHandler from '../utils/asyncHandler.js';
import userService from '../services/user.js';

const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.user, req.body);
  res.status(201).json(user);
});

const list = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.validatedQuery);
  res.status(200).json(result);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserPublicById(req.user.id);
  // Effective permissions from the current request (already re-derived
  // fresh from the DB by authenticate.js) — lets a client know what to
  // show/hide without a second round trip or reimplementing the role ->
  // permission resolution itself.
  res.status(200).json({ ...user, permissions: [...req.permissions].sort() });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateOwnProfile(req.user, req.body);
  res.status(200).json(user);
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserPublicById(req.params.id);
  res.status(200).json(user);
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.user, req.params.id, req.body);
  res.status(200).json(user);
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.user, req.params.id);
  res.status(200).json(user);
});

const reactivate = asyncHandler(async (req, res) => {
  const user = await userService.reactivateUser(req.user, req.params.id);
  res.status(200).json(user);
});

const changeOwnPassword = asyncHandler(async (req, res) => {
  await userService.changeOwnPassword(req.user, req.body);
  res.status(200).json({ message: 'Password updated' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await userService.resetPassword(req.user, req.params.id, req.body.newPassword);
  res.status(200).json({ message: 'Password reset' });
});

export default { create, list, getMe, updateMe, getById, update, deactivate, reactivate, changeOwnPassword, resetPassword };
