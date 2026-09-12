import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(user) {
  // `type: 'tenant_user'` mirrors the super-admin token's `type` claim —
  // keeps the two token kinds from being interchangeable even if a secret
  // were ever shared by mistake.
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, role: user.role, type: 'tenant_user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function signup({ tenantName, subdomain, ownerName, ownerEmail, ownerPassword }) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existing) {
    throw ApiError.conflict('That subdomain is already taken');
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const { tenant, owner } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName, subdomain, plan: 'trial' },
    });

    await tx.location.create({
      data: { tenantId: tenant.id, name: 'Main Location' },
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: ownerName,
        email: ownerEmail,
        passwordHash,
        role: 'OWNER',
      },
    });

    return { tenant, owner };
  });

  const token = signToken(owner);
  return { token, tenant, user: sanitize(owner) };
}

async function login({ subdomain, email, password }) {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const token = signToken(user);
  return { token, user: sanitize(user) };
}

function sanitize(user) {
  const { passwordHash, ...safe } = user; // eslint-disable-line no-unused-vars
  return safe;
}

export default { signup, login };
