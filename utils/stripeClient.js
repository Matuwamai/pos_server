import Stripe from 'stripe';

// Each tenant brings their own Stripe secret key (see services/stripeCredential.js) —
// there's no single platform-wide account, so a client is built per call rather than
// once at module load, unlike a typical single-account Stripe integration.
function buildStripeClient(secretKey) {
  return new Stripe(secretKey);
}

export default buildStripeClient;
