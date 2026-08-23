const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillSubscriptions() {
  const users = await prisma.user.findMany({
    include: { subscription: true }
  });

  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    if (!user.subscription) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          status: 'INTERNAL_FREE', // By default give early users free access
        }
      });
      console.log(`Created INTERNAL_FREE subscription for ${user.email}`);
    } else {
      console.log(`User ${user.email} already has a subscription: ${user.subscription.status}`);
    }
  }
}

backfillSubscriptions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
