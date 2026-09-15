import env from '../config/env.js';
import logger from '../config/logger.js';

// Called directly via fetch rather than the official `africastalking` SDK —
// that package pulls in a badly outdated, vulnerable axios (dozens of CVEs)
// plus vulnerable lodash/joi transitively. The API itself is a single plain
// REST endpoint, not worth that dependency surface for.
const BASE_URL = 'https://api.africastalking.com/version1/messaging';
const SANDBOX_BASE_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

function isConfigured() {
  return Boolean(env.africastalking.apiKey && env.africastalking.username);
}

// Returns { success, providerMessageId, cost, failureReason }. Never
// throws — a failed/unconfigured send is a normal, expected outcome the
// caller (services/smsOtp.js, etc.) records on the SmsMessage row rather
// than something that should abort the request that triggered it.
async function sendSms({ phone, message }) {
  if (!isConfigured()) {
    logger.warn("Africa's Talking is not configured — SMS not actually sent", { phone });
    return { success: false, failureReason: 'SMS provider not configured' };
  }

  const url = env.africastalking.sandbox ? SANDBOX_BASE_URL : BASE_URL;
  const body = new URLSearchParams({ username: env.africastalking.username, to: phone, message });
  if (env.africastalking.senderId) {
    body.set('from', env.africastalking.senderId);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apiKey: env.africastalking.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const data = await response.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (!response.ok || !recipient) {
      const message = data?.SMSMessageData?.Message || `Unexpected response (HTTP ${response.status})`;
      logger.error("Africa's Talking send failed", { phone, message });
      return { success: false, failureReason: message };
    }

    const success = recipient.status === 'Success';
    return {
      success,
      providerMessageId: recipient.messageId,
      cost: parseCost(recipient.cost),
      failureReason: success ? null : recipient.status,
    };
  } catch (err) {
    logger.error("Africa's Talking request failed", { phone, message: err.message });
    return { success: false, failureReason: err.message };
  }
}

// Africa's Talking returns cost as a string like "KES 0.8000".
function parseCost(costString) {
  if (!costString) return null;
  const match = costString.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

export default { sendSms, isConfigured };
