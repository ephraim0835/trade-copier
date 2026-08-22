import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function initOwner() {
  const email = process.env.OWNER_EMAIL || 'admin@tradecopier.local';
  const password = process.env.OWNER_PASSWORD || 'ChangeMe123!';
  const secret = process.env.OWNER_INIT_SECRET;

  if (!secret) {
    console.error('OWNER_INIT_SECRET is not set in .env');
    process.exit(1);
  }

  const existingOwner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
  });

  if (existingOwner) {
    console.log('Owner account already exists. Skipping initialization.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newOwner = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'OWNER',
    },
  });

  console.log(`Owner account created successfully: ${newOwner.email}`);
  
  // Create an initial Master account for the owner
  const masterAccount = await prisma.mt5Account.create({
    data: {
      userId: newOwner.id,
      login: 'MASTER-001',
      broker: 'Broker-Server',
      server: 'Server-Demo',
      role: 'MASTER',
      isActive: true,
    }
  });

  console.log(`Initial Master Account created: ${masterAccount.login}`);
}

initOwner()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
