import prisma from '../config/prismaClient.js';
async function main() {
  const [code, ...roleNames] = process.argv.slice(2);
  if (!code || roleNames.length === 0) {
    console.error('Usage: node scripts/backfillRolePermission.js <permission.code> <ROLE_NAME> [ROLE_NAME...]');
    process.exit(1);
  }

  const permission = await prisma.permission.findUnique({ where: { code } });
  if (!permission) throw new Error(`Permission "${code}" is not in the catalog — run seedPermissions.js first`);

  const roles = await prisma.role.findMany({ where: { name: { in: roleNames }, isSystem: true } });
  console.log(`Granting "${code}" to ${roles.length} existing system role(s) named ${roleNames.join('/')}...`);

  let granted = 0;
  for (const role of roles) {
    const result = await prisma.rolePermission.createMany({
      data: [{ roleId: role.id, permissionId: permission.id }],
      skipDuplicates: true,
    });
    granted += result.count;
  }

  console.log(`Done. ${granted} role(s) newly granted (the rest already had it).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
