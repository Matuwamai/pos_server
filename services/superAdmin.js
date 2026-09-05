
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
 
const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.SUPER_ADMIN_JWT_EXPIRES_IN || '4h';
 
function signToken(admin) {
  // `type: 'super_admin'` distinguishes this token from a tenant-user JWT
  // even if they ever accidentally shared a secret — they don't (see
  // requireSuperAdmin.js), but the explicit type claim is a second guard.
  return jwt.sign({ sub: admin.id, type: 'super_admin' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}
 
async function login({ email, password }) {
  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }
 
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
 
  const token = signToken(admin);
  return { token, admin: sanitize(admin) };
}
 
// Only reachable by an already-authenticated super admin (enforced in
// routes, not here) — deliberately no public self-registration for
// platform-level access.
async function createSuperAdmin({ name, email, password }) {
  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('A super admin with this email already exists');
  }
 
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.superAdmin.create({
    data: { name, email, passwordHash },
  });
 
  return sanitize(admin);
}
 
function sanitize(admin) {
  const { passwordHash, ...safe } = admin; // eslint-disable-line no-unused-vars
  return safe;
}
 
export default { login, createSuperAdmin };