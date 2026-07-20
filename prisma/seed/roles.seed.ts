import { PrismaClient } from '@prisma/client';

const ROLES = [
  {
    name: 'ADMIN',
    description: 'Full system access',
  },
  {
    name: 'USER',
    description: 'Standard user access',
  },
] as const;

export async function seedRoles(prisma: PrismaClient) {
  console.log('→ Seeding roles...');

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description,
      },
    });
  }

  console.log(`  ✓ Upserted ${ROLES.length} roles`);
}
