import crypto from 'crypto';
import logger from '../config/logger.js';
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
