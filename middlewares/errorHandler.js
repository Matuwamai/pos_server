import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
function errorHandler(err, req, res, next) {
  const requestId = req.requestId;
  const context = {
    requestId,
    tenantId: req.tenantId || null,
    userId: req.user ? req.user.id : null,
    method: req.method,
    path: req.originalUrl,
  };

  if (err instanceof ApiError) {
    logger.warn(err.message, { ...context, statusCode: err.statusCode, details: err.details });
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
      requestId,
    });
  }
  if (err.code === 'P2002') {
    logger.warn('Unique constraint violation', { ...context, meta: err.meta });
    return res.status(409).json({ error: 'A record with this value already exists.', requestId });
  }
  if (err.code === 'P2025') {
    logger.warn('Record not found', { ...context, meta: err.meta });
    return res.status(404).json({ error: 'Record not found.', requestId });
  }
  logger.error(err.message, { ...context, stack: err.stack });
  return res.status(500).json({ error: 'Internal server error', requestId });
}

export default errorHandler;
