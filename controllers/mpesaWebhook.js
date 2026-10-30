import asyncHandler from '../utils/asyncHandler.js';
import mpesaPaymentIntentService from '../services/mpesaPaymentIntent.js';
import logger from '../config/logger.js';

// Always responds 200 regardless of outcome — Safaricom retries
// aggressively on anything else, and a malformed/unknown callback is not
// something a retry would fix (same reasoning as the billing webhook).
const handleStkCallback = asyncHandler(async (req, res) => {
  try {
    await mpesaPaymentIntentService.handleCallback(req.params.intentId, req.body);
  } catch (err) {
    logger.error('M-Pesa STK callback handling failed', { message: err.message, intentId: req.params.intentId });
  }
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export default { handleStkCallback };
