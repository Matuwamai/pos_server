import crypto from 'crypto';
import logger from '../config/logger.js';
// Attaches a unique requestId to every request (also returned as a response
// header) and logs one line per request on completion, including
// tenantId/userId once authenticate() has run. This is what lets you grep
// logs for a single request's full lifecycle, and what a support ticket
// like "order X failed for tenant Y" actually needs to be debuggable.
function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      tenantId: req.tenantId || null,
      userId: req.user ? req.user.id : null,
    });
  });

  next();
}

export default requestLogger;
