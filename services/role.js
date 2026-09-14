import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import DEFAULT_ROLE_PERMISSIONS from '../config/defaultRolePermissions.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const roleInclude = {
  permissions: { include: { permission: { select: { id: true, code: true, category: true } } } },
  _count: { select: { users: true } },
};

// The join table wraps each permission in a RolePermission row — flatten
// that into a plain array for API consumers, same treatment product.js
// gives its modifierGroups.
function serializeRole(role) {
  if (!role) return role;
  const { permissions, ...rest } = role;
  return { ...rest, permissions: permissions.map((rp) => rp.permission) };
}

// Called once, inside the same transaction that creates a tenant (signup or
// admin-provisioning) — there's no ALS tenant context yet at that point, so
// tenantId is taken explicitly rather than relying on the scoping
// extension. Returns { [roleName]: roleId } so the caller can assign the
// new OWNER user to the right one.
async function seedDefaultRolesForTenant(tx, tenantId) {
  const allPermissions = await tx.permission.findMany({ select: { id: true, code: true } });
  const permissionIdByCode = new Map(allPermissions.map((p) => [p.code, p.id]));

  const roleIdByName = {};
  for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await tx.role.create({ data: { tenantId, name: roleName, isSystem: true } });
    roleIdByName[roleName] = role.id;

    const permissionRows = codes
      .map((code) => permissionIdByCode.get(code))
      .filter(Boolean) // tolerates a code listed here that hasn't been seeded into Permission yet
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (permissionRows.length > 0) {
      await tx.rolePermission.createMany({ data: permissionRows });
    }
  }

  return roleIdByName;
}

async function assertNameAvailable(name, excludeId) {
  const existing = await prisma.role.findFirst({ where: { name, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (existing) throw ApiError.conflict('A role with this name already exists');
}

async function createRole({ name, permissionCodes }) {
  await assertNameAvailable(name);
  const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes || [] } } });

  const roleId = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { name, isSystem: false } });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    }
    return role.id;
  });

  return getRoleById(roleId);
}

async function listRoles({ search, isActive, page, limit }) {
  const where = { ...(isActive !== undefined ? { isActive } : {}), ...searchFilter(search, ['name']) };

  const [total, roles] = await prisma.$transaction([
    prisma.role.count({ where }),
    prisma.role.findMany({ where, orderBy: { name: 'asc' }, ...getPagination({ page, limit }), include: roleInclude }),
  ]);

  return { data: roles.map(serializeRole), pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getRoleById(id) {
  const role = await prisma.role.findUnique({ where: { id }, include: roleInclude });
  if (!role) throw ApiError.notFound('Role not found');
  return serializeRole(role);
}

async function getRoleRaw(id) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

async function updateRole(id, { name, permissionCodes }) {
  await getRoleRaw(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  if (name) {
    await assertNameAvailable(name, id);
  }

  await prisma.$transaction(async (tx) => {
    if (name) {
      await tx.role.update({ where: { id }, data: { name } });
    }
    if (permissionCodes) {
      const permissions = await tx.permission.findMany({ where: { code: { in: permissionCodes } } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: id, permissionId: p.id })) });
      }
    }
  });

  return getRoleById(id);
}

async function deactivateRole(id) {
  const role = await getRoleRaw(id);
  if (role.isSystem && role.name === 'OWNER') {
    throw ApiError.conflict('The Owner role cannot be deactivated — a tenant must always have at least one fully-privileged role');
  }
  if (!role.isActive) {
    throw ApiError.conflict('Role is already inactive');
  }

  const assignedActiveUsers = await prisma.user.count({ where: { assignedRoleId: id, isActive: true } });
  if (assignedActiveUsers > 0) {
    throw ApiError.conflict(`Cannot deactivate a role assigned to ${assignedActiveUsers} active user(s) — reassign them first`);
  }

  return prisma.role.update({ where: { id }, data: { isActive: false } });
}

async function reactivateRole(id) {
  const role = await getRoleRaw(id);
  if (role.isActive) {
    throw ApiError.conflict('Role is already active');
  }
  return prisma.role.update({ where: { id }, data: { isActive: true } });
}

export default { seedDefaultRolesForTenant, createRole, listRoles, getRoleById, getRoleRaw, updateRole, deactivateRole, reactivateRole };
