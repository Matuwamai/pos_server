import ApiError from '../utils/ApiError.js';

// Usage: router.post('/products', authenticate, requireRole('OWNER', 'MANAGER'), controller.create)
// Must run after authenticate() — relies on req.user.role.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

export default requireRole;
