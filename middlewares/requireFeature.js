import ApiError from '../utils/ApiError.js';
import { planHasFeature } from '../config/plans.js';

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
