// Plan -> feature mapping, kept as code rather than a DB table: plans are a
// product decision made by deploying new code, not data a super admin edits
// at runtime (there's no admin UI for that, and adding one is unwarranted
// until it's actually needed). Subscription.planCode is the only thing that
// ties a tenant to one of these.
const PLANS = {
  trial: {
    name: 'Trial',
    features: ['pos', 'inventory'],
  },
  starter: {
    name: 'Starter',
    features: ['pos', 'inventory'],
  },
  pro: {
    name: 'Pro',
    features: ['pos', 'inventory', 'loyalty', 'promotions', 'multi_location'],
  },
  enterprise: {
    name: 'Enterprise',
    features: ['*'],
  },
};

function planHasFeature(planCode, feature) {
  const plan = PLANS[planCode];
  if (!plan) return false;
  return plan.features.includes('*') || plan.features.includes(feature);
}

export { PLANS, planHasFeature };
