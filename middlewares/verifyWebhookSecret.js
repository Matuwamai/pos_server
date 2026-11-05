import ApiError from '../utils/ApiError.js';

const WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET;
function verifyWebhookSecret(req, res, next) {
  const provided = req.headers['x-webhook-secret'];
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return next(ApiError.unauthorized('Invalid webhook credentials'));
  }
  return next();
}

export default verifyWebhookSecret;
