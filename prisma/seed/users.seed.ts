import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const USERS = [
  {
    email: 'admin@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    roleName: 'ADMIN',
  },
  {
    email: 'user@example.com',
    password: 'User123!',
    name: 'Demo User',
    roleName: 'USER',
  },
] as const;

export async function seedUsers(prisma: PrismaClient) {
  console.log('→ Seeding users...');

  for (const user of USERS) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: user.roleName },
    });

    const hashedPassword = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: hashedPassword,
        roleId: role.id,
      },
      create: {
        email: user.email,
        name: user.name,
        password: hashedPassword,
        roleId: role.id,
      },
    });
  }

  console.log(`  ✓ Upserted ${USERS.length} users`);
}
