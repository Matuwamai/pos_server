import prisma from '../config/prismaClient.js';
async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
}

export default { listPermissions };
