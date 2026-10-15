import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    const oldAdmin = await prisma.user.findUnique({
      where: { email: 'admin@tradecopier.local' }
    });

    if (oldAdmin) {
      await prisma.mt5Account.deleteMany({
        where: { userId: oldAdmin.id }
      });
      await prisma.user.delete({
        where: { email: 'admin@tradecopier.local' }
      });
      console.log('Deleted old admin account.');
    } else {
      console.log('Old admin not found.');
    }

    const hashedPassword = await bcrypt.hash('@Soyini08', 10);
    const newOwner = await prisma.user.upsert({
      where: { email: 'ofoliephraim@gmail.com' },
      update: {
        password: hashedPassword,
        name: 'Ephraim ofoli',
        role: 'OWNER',
        emailVerified: true
      },
      create: {
        email: 'ofoliephraim@gmail.com',
        password: hashedPassword,
        name: 'Ephraim ofoli',
        role: 'OWNER',
        emailVerified: true
      }
    });

    console.log(`Owner account set up: ${newOwner.email}`);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
