import asyncHandler from '../utils/asyncHandler.js';
import permissionService from '../services/permission.js';

const list = asyncHandler(async (req, res) => {
  const permissions = await permissionService.listPermissions();
  res.status(200).json(permissions);
});

export default { list };
