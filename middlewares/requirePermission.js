import ApiError from '../utils/ApiError.js';
function requirePermission(code) {
  return (req, res, next) => {
    if (!req.permissions || !req.permissions.has(code)) {
      return next(ApiError.forbidden(`Missing required permission: ${code}`));
    }
    return next();
  };
}

export default requirePermission;
