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
