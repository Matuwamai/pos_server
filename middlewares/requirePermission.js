import ApiError from '../utils/ApiError.js';

// Usage: router.post('/', authenticate, requirePermission('products.create'), controller.create)
// Must run after authenticate() or authenticateApiKey() — both set
// req.permissions to a Set<string> of the codes the caller currently holds,
// so this works identically regardless of which one ran.
function requirePermission(code) {
  return (req, res, next) => {
    if (!req.permissions || !req.permissions.has(code)) {
      return next(ApiError.forbidden(`Missing required permission: ${code}`));
    }
    return next();
  };
}

export default requirePermission;
