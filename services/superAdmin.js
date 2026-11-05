
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
 
const JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.SUPER_ADMIN_JWT_EXPIRES_IN || '4h';
 
function signToken(admin) {
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
  const { passwordHash, ...safe } = admin; 
  return safe;
}
 
export default { login, createSuperAdmin };