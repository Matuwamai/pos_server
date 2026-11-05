import prisma from '../config/prismaClient.js';
import PERMISSIONS from '../config/permissions.js';

async function main() {
  console.log(`Seeding ${PERMISSIONS.length} permissions...`);

  for (const { code, category, description } of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { category, description },
      create: { code, category, description },
    });
  }

  const total = await prisma.permission.count();
  console.log(`Done. ${total} permissions now in the catalog.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
