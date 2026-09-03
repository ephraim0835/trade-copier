const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.mt5Account.findFirst({
    where: { isActive: true }
  });

  if (!account) {
    console.log("No active account found to seed.");
    return;
  }

  const now = new Date();
  
  for(let i=4; i>=0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const equity = (account.balance || 10000) + (Math.random() * 500 - 200);
    
    await prisma.accountSnapshot.create({
      data: {
        mt5AccountId: account.id,
        balance: account.balance || 10000,
        equity: equity,
        floatingPl: equity - (account.balance || 10000),
        timestamp: timestamp
      }
    });
    console.log(`Created snapshot for ${timestamp.toISOString()} with equity ${equity}`);
  }
}

main().finally(() => prisma.$disconnect());
