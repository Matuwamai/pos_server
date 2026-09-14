import prisma from '../config/prismaClient.js';
import roleService from '../services/role.js';
import { runWithTenant } from '../config/tenantContext.js';

// One-time migration helper for tenants that existed before the Role/
// Permission system: ensures every tenant has the 5 default roles, then
// assigns each of its existing users (that don't already have one) to the
// role matching their legacy enum value by name. Safe to re-run — skips
// tenants that already have roles, and only touches users with a null
// assignedRoleId.
async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, subdomain: true } });
  console.log(`Checking ${tenants.length} tenant(s)...`);

  for (const tenant of tenants) {
    await runWithTenant(tenant.id, async () => {
      const existingRoleCount = await prisma.role.count();
      let roleIdByName;

      if (existingRoleCount === 0) {
        roleIdByName = await prisma.$transaction((tx) => roleService.seedDefaultRolesForTenant(tx, tenant.id));
        console.log(`  ${tenant.subdomain}: seeded 5 default roles`);
      } else {
        const roles = await prisma.role.findMany({ where: { isSystem: true }, select: { id: true, name: true } });
        roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
        console.log(`  ${tenant.subdomain}: already has roles, skipped seeding`);
      }

      const usersToBackfill = await prisma.user.findMany({ where: { assignedRoleId: null } });
      let assigned = 0;
      for (const user of usersToBackfill) {
        const roleId = roleIdByName[user.role];
        if (roleId) {
          await prisma.user.update({ where: { id: user.id }, data: { assignedRoleId: roleId } });
          assigned++;
        }
      }
      if (assigned > 0) {
        console.log(`  ${tenant.subdomain}: assigned ${assigned} user(s) to their matching role`);
      }
    });
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
