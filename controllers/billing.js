import asyncHandler from '../utils/asyncHandler.js';
import subscriptionService from '../services/subscription.js';
import logger from '../config/logger.js';

const handleWebhook = asyncHandler(async (req, res) => {
  const { event, tenantId, planCode, currentPeriodEnd, externalCustomerId, externalSubId } = req.body;
  logger.info('Billing webhook received', { event, tenantId });

  switch (event) {
    case 'activated':
      await subscriptionService.activate({ tenantId, planCode, currentPeriodEnd, externalCustomerId, externalSubId });
      break;
    case 'renewed':
      await subscriptionService.renew({ tenantId, currentPeriodEnd });
      break;
    case 'past_due':
      await subscriptionService.markPastDue({ tenantId });
      break;
    case 'cancelled':
      await subscriptionService.cancel({ tenantId });
      break;
  }

  res.status(200).json({ received: true });
});

export default { handleWebhook };
