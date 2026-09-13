import asyncHandler from '../utils/asyncHandler.js';
import auditLogService from '../services/auditLog.js';

const list = asyncHandler(async (req, res) => {
  const result = await auditLogService.listAuditLogs(req.validatedQuery);
  res.status(200).json(result);
});

export default { list };
