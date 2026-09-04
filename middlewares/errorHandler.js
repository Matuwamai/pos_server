import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
// Must be registered LAST in app.js, after all routes.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const requestId = req.requestId;
  const context = {
    requestId,
    tenantId: req.tenantId || null,
    userId: req.user ? req.user.id : null,
    method: req.method,
    path: req.originalUrl,
  };

  if (err instanceof ApiError) {
    // Operational errors (bad input, not found, auth failures) are expected
    // traffic, not bugs — log at warn so they don't drown out real problems.
    logger.warn(err.message, { ...context, statusCode: err.statusCode, details: err.details });
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
      requestId,
    });
  }

  // Known Prisma error codes worth surfacing cleanly instead of a generic 500
  if (err.code === 'P2002') {
    logger.warn('Unique constraint violation', { ...context, meta: err.meta });
    return res.status(409).json({ error: 'A record with this value already exists.', requestId });
  }
  if (err.code === 'P2025') {
    logger.warn('Record not found', { ...context, meta: err.meta });
    return res.status(404).json({ error: 'Record not found.', requestId });
  }

  // Anything else is unexpected — log at error level with full stack so it
  // surfaces in monitoring/alerting as something that needs a fix.
  logger.error(err.message, { ...context, stack: err.stack });
  return res.status(500).json({ error: 'Internal server error', requestId });
}

export default errorHandler;
