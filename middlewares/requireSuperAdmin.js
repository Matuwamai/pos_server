import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
 
const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;
 
// Verifies a super-admin-issued JWT (obtained via POST /admin/admins/login).
// Checked against a SEPARATE secret from tenant-user JWTs
// (SUPER_ADMIN_JWT_SECRET vs JWT_SECRET) — a compromised tenant token can
// never be replayed here, and vice versa, even if someone forgot the
// `type` claim check below.
function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
 
  const token = header.split(' ')[1];
 
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'super_admin') {
      return next(ApiError.forbidden('Super-admin access required'));
    }
    req.superAdmin = { id: payload.sub };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}
 
export default requireSuperAdmin;
 