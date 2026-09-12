import { z } from 'zod';

// Internal event shape for the webhook stub — NOT a real provider's payload.
// Once a billing provider is chosen, this gets replaced by mapping that
// provider's actual event schema onto services/subscription.js's calls.
const webhookEvent = {
  body: z.object({
    event: z.enum(['activated', 'renewed', 'past_due', 'cancelled']),
    tenantId: z.string().uuid(),
    planCode: z.string().min(1).max(50).optional(),
    currentPeriodEnd: z.coerce.date().optional(),
    externalCustomerId: z.string().min(1).optional(),
    externalSubId: z.string().min(1).optional(),
  }),
};

export default { webhookEvent };
