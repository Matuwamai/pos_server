import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient.js';
 
async function main() {
  const [, , name, email, password] = process.argv;
 
  if (!name || !email || !password) {
    console.error('Usage: node scripts/createSuperAdmin.js "<name>" <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }
 
  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.error(`A super admin with email "${email}" already exists.`);
    process.exit(1);
  }
 
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.superAdmin.create({
    data: { name, email, passwordHash },
  });
 
  console.log(`Super admin created: ${admin.email} (id: ${admin.id})`);
  await prisma.$disconnect();
}
 
main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});