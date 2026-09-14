import prisma from '../config/prismaClient.js';

// Read-only — the catalog is seeded (scripts/seedPermissions.js), never
// created or edited through the API. Used to build a role editor's "menu"
// of assignable permissions.
async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
}

export default { listPermissions };
