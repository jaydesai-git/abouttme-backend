import { PrismaClient } from '@prisma/client';
import { seedRoles } from './roles.seed';
import { seedUsers } from './users.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  await seedRoles(prisma);
  await seedUsers(prisma);

  console.log('\n✅ Database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
