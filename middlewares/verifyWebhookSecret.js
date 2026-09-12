import ApiError from '../utils/ApiError.js';

const WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET;

// STUB auth for the billing webhook: a shared secret compared against a
// header, just so this endpoint isn't wide open while no real billing
// provider is wired up. Replace with real provider-specific signature
// verification (e.g. Stripe's `stripe.webhooks.constructEvent`, checked
// against the raw request body) once a provider is chosen — a shared
// secret alone is not sufficient for a real webhook, since it doesn't
// prove the payload wasn't tampered with in transit.
function verifyWebhookSecret(req, res, next) {
  const provided = req.headers['x-webhook-secret'];
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return next(ApiError.unauthorized('Invalid webhook credentials'));
  }
  return next();
}

export default verifyWebhookSecret;
