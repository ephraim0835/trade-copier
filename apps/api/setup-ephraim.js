const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_oNcju3Xt7JDs@ep-summer-sky-ax7h2to2-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&pgbouncer=true',
    }
  }
});

async function main() {
  try {
    // 1. Delete the admin@tradecopier.local user and its associated MT5 accounts
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
    }

    // 2. Check if new user already exists
    let user = await prisma.user.findUnique({
      where: { email: 'ofoliephraim@gmail.com' }
    });

    if (!user) {
      // 3. Create the new user
      const hashedPassword = await bcrypt.hash('@Soyini08', 10);
      user = await prisma.user.create({
        data: {
          name: 'Ephraim ofoli',
          email: 'ofoliephraim@gmail.com',
          password: hashedPassword,
          role: 'OWNER',
          emailVerified: true
        }
      });
      console.log(`Created new owner account for ${user.email}`);

      // 4. Create an initial master account to match what the script did
      const masterAccount = await prisma.mt5Account.create({
        data: {
          userId: user.id,
          login: 'MASTER-001',
          broker: 'Broker-Server',
          server: 'Server-Demo',
          role: 'MASTER',
          isActive: true,
        }
      });
      console.log(`Created initial MT5 Master account for ${user.email}`);
    } else {
      console.log('Account ofoliephraim@gmail.com already exists. Updating role/password just in case.');
      const hashedPassword = await bcrypt.hash('@Soyini08', 10);
      await prisma.user.update({
        where: { email: 'ofoliephraim@gmail.com' },
        data: {
          name: 'Ephraim ofoli',
          password: hashedPassword,
          role: 'OWNER',
          emailVerified: true
        }
      });
      console.log('Updated existing account.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
