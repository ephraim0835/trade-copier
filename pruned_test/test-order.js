const { PrismaClient } = require('../../packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subAccountId = 'DEMO-SUB-1';

  // 1. Ensure sub account exists
  const sub = await prisma.mt5Account.upsert({
    where: { id: subAccountId },
    update: { isDemo: true, isActive: true },
    create: {
      id: subAccountId,
      login: 476520554, // The user's demo account login from the screenshot
      password: 'test',
      server: 'Exness-MT5Trial9',
      isDemo: true,
      isActive: true,
    }
  });

  // 2. Insert command
  const cmd = await prisma.executionCommand.create({
    data: {
      id: 'test-cmd-' + Date.now(),
      subAccountId: sub.id,
      tradeCopyId: 'tc-dummy',
      orderType: 'BUY',
      symbol: 'BCHUSDm', // The chart symbol they are on
      volume: 0.1,
      status: 'CREATED',
      expiresAt: new Date(Date.now() + 60000), // expires in 1 min
    }
  });

  console.log('✅ TEST ORDER INSERTED:', cmd.id);
  console.log('The EA should pick this up on its next poll (within 5 seconds).');
}

main().catch(console.error).finally(() => prisma.$disconnect());
