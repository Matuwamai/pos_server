import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient.js';

// One-off migration: PINs used to be stored in plaintext. Any value that is
// not already a bcrypt hash is hashed in place. Safe to re-run.
const BCRYPT_PREFIX = /^\$2[aby]\$/;

async function main() {
  const users = await prisma.user.findMany({ where: { pinCode: { not: null } }, select: { id: true, pinCode: true } });
  let hashed = 0;
  for (const user of users) {
    if (BCRYPT_PREFIX.test(user.pinCode)) continue;
    await prisma.user.update({ where: { id: user.id }, data: { pinCode: await bcrypt.hash(user.pinCode, 10) } });
    hashed++;
  }
  console.log(`PIN codes checked: ${users.length}, hashed: ${hashed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
