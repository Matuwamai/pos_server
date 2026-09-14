import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import auditLogService from './auditLog.js';
import roleService from './role.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const PRIVILEGED_ROLES = ['OWNER', 'MANAGER'];

function sanitize(user) {
  const { passwordHash, ...safe } = user; // eslint-disable-line no-unused-vars
  return safe;
}

// A MANAGER can create/edit staff, but never at OWNER/MANAGER level itself
// (nor touch an existing OWNER at all) — only an OWNER can grant that much
// access or modify another OWNER, to block privilege escalation.
function assertCanAssignRole(actingUser, targetRole) {
  if (actingUser.role === 'MANAGER' && PRIVILEGED_ROLES.includes(targetRole)) {
    throw ApiError.forbidden('Only an OWNER can create or promote an OWNER/MANAGER account');
  }
}

function assertCanModifyTarget(actingUser, targetUser) {
  if (actingUser.role === 'MANAGER' && targetUser.role === 'OWNER') {
    throw ApiError.forbidden('Only an OWNER can modify another OWNER');
  }
}

async function createUser(actingUser, { name, email, password, role, assignedRoleId, pinCode, commissionRate }) {
  assertCanAssignRole(actingUser, role);
  if (assignedRoleId) {
    await roleService.getRoleRaw(assignedRoleId); // 404s if missing/foreign tenant
  } else {
    // No explicit assignedRoleId — fall back to the tenant's system role
    // matching the legacy enum value, so every new user is automatically
    // wired into the permission system without the caller having to know
    // its role id. Only works while a tenant hasn't renamed/removed that
    // system role; if they have, the caller must pass assignedRoleId
    // explicitly instead.
    const defaultRole = await prisma.role.findFirst({ where: { name: role, isSystem: true } });
    assignedRoleId = defaultRole?.id ?? null;
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash, role, assignedRoleId, pinCode, commissionRate } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      metadata: { role, email },
    });
    return sanitize(user);
  });
}

async function listUsers({ search, role, isActive, page, limit }) {
  const where = {
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...searchFilter(search, ['name', 'email']),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { name: 'asc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: users.map(sanitize), pagination: buildPaginationMeta({ page, limit, total }) };
}

// Raw (with passwordHash) — for internal callers like changeOwnPassword.
async function getUserRaw(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function getUserPublicById(id) {
  return sanitize(await getUserRaw(id));
}

async function updateUser(actingUser, id, updates) {
  const user = await getUserRaw(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  assertCanModifyTarget(actingUser, user);
  if (updates.role) {
    assertCanAssignRole(actingUser, updates.role);
  }
  if (updates.assignedRoleId) {
    await roleService.getRoleRaw(updates.assignedRoleId); // 404s if missing/foreign tenant
  }
  if (updates.email) {
    const existing = await prisma.user.findFirst({ where: { email: updates.email, NOT: { id } } });
    if (existing) throw ApiError.conflict('A user with this email already exists');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: updates });
    if (updates.role && updates.role !== user.role) {
      await auditLogService.recordAuditLog(tx, {
        userId: actingUser.id,
        action: 'user.role_change',
        entityType: 'User',
        entityId: id,
        metadata: { from: user.role, to: updates.role },
      });
    }
    return sanitize(updated);
  });
}

async function deactivateUser(actingUser, id) {
  if (actingUser.id === id) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  const user = await getUserRaw(id);
  assertCanModifyTarget(actingUser, user);
  if (!user.isActive) throw ApiError.conflict('User is already inactive');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isActive: false } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'user.deactivate',
      entityType: 'User',
      entityId: id,
      metadata: {},
    });
    return sanitize(updated);
  });
}

async function reactivateUser(actingUser, id) {
  const user = await getUserRaw(id);
  assertCanModifyTarget(actingUser, user);
  if (user.isActive) throw ApiError.conflict('User is already active');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isActive: true } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'user.reactivate',
      entityType: 'User',
      entityId: id,
      metadata: {},
    });
    return sanitize(updated);
  });
}

async function changeOwnPassword(actingUser, { currentPassword, newPassword }) {
  const user = await getUserRaw(actingUser.id);
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
}

// Admin-driven reset (forgotten password) — no currentPassword check, since
// the acting user isn't the account owner.
async function resetPassword(actingUser, id, newPassword) {
  const user = await getUserRaw(id);
  assertCanModifyTarget(actingUser, user);

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await auditLogService.recordAuditLog(tx, {
      userId: actingUser.id,
      action: 'user.password_reset',
      entityType: 'User',
      entityId: id,
      metadata: {},
    });
  });
}

export default {
  createUser,
  listUsers,
  getUserPublicById,
  updateUser,
  deactivateUser,
  reactivateUser,
  changeOwnPassword,
  resetPassword,
};
