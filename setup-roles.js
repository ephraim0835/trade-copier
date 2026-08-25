const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?connection_limit=10"
    }
  }
});

async function run() {
  const email1 = 'ofoliephraim@gmail.com';
  const user1 = await prisma.user.findUnique({ where: { email: email1 } });
  if (user1) {
    // Highest paid plan features forever
    await prisma.subscription.upsert({
      where: { userId: user1.id },
      update: { status: 'INTERNAL_FREE', planId: 'pro' },
      create: { userId: user1.id, status: 'INTERNAL_FREE', planId: 'pro' }
    });
    console.log(`✅ Updated ${email1} to highest plan (INTERNAL_FREE).`);
  } else {
    console.log(`❌ User ${email1} not found. Please log in first to create the account.`);
  }

  const email2 = 'ofoli.ephraim2008@gmail.com';
  const user2 = await prisma.user.findUnique({ where: { email: email2 } });
  if (user2) {
    // Admin access
    await prisma.user.update({
      where: { id: user2.id },
      data: { role: 'ADMIN' }
    });
    console.log(`✅ Updated ${email2} to ADMIN.`);
  } else {
    console.log(`❌ User ${email2} not found. Please log in first to create the account.`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
