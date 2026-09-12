import ApiError from '../utils/ApiError.js';
import { planHasFeature } from '../config/plans.js';

// Usage: router.post('/promotions', authenticate, requireFeature('promotions'), controller.create)
// Must run after authenticate() — relies on req.planCode.
function requireFeature(feature) {
  return (req, res, next) => {
    if (!planHasFeature(req.planCode, feature)) {
      return next(
        ApiError.paymentRequired('Your current plan does not include this feature', {
          code: 'FEATURE_NOT_AVAILABLE',
          feature,
        })
      );
    }
    return next();
  };
}

export default requireFeature;
