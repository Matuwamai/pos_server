import ApiError from '../utils/ApiError.js';
 
// PLACEHOLDER AUTH — tenant management is a platform-admin concern that
// spans tenants, so the normal `authenticate` middleware (which resolves a
// single req.tenantId from a tenant-scoped JWT) does not apply here.
//
// For now this checks a shared secret header so these routes aren't wide
// open. Replace this with real super-admin authentication (e.g. a separate
// admin-user table + its own JWT, or SSO) before going anywhere near
// production — a static key in an env var is not an acceptable long-term
// answer for endpoints that can suspend or cancel a paying customer.
function requireSuperAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.SUPER_ADMIN_KEY) {
    return next(ApiError.forbidden('Super-admin access required'));
  }
  return next();
}
 
export default requireSuperAdmin;
 