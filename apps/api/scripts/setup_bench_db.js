const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
  const master = await prisma.mt5Account.upsert({
    where: { id: 'bench-master' },
    update: {},
    create: {
      id: 'bench-master',
      broker: 'Test',
      accountNumber: '1000',
      accountName: 'Master',
      isDemo: true,
      isActive: true,
      login: '1000',
      server: 'Test-Server',
      tokens: {
        create: {
          id: 'bench-master-token',
          tokenHash: await bcrypt.hash('secret123', 10),
          name: 'Bench Master Token'
        }
      }
    }
  });

  const sub = await prisma.mt5Account.upsert({
    where: { id: 'bench-sub' },
    update: {},
    create: {
      id: 'bench-sub',
      broker: 'Test',
      accountNumber: '2000',
      accountName: 'Sub',
      isDemo: true,
      isActive: true,
      login: '2000',
      server: 'Test-Server',
      tokens: {
        create: {
          id: 'bench-sub-token',
          tokenHash: await bcrypt.hash('secret123', 10),
          name: 'Bench Sub Token'
        }
      }
    }
  });

  await prisma.tradeCopySettings.upsert({
    where: { subAccountId: sub.id },
    update: {},
    create: {
      id: 'bench-copy-settings',
      masterAccountId: master.id,
      subAccountId: sub.id,
      isActive: true,
      copyLimitOrders: true,
      copyStopOrders: true,
      copySlTp: true,
      lotMultiplier: 1.0,
      maxRiskPerTradePct: 2.0
    }
  });

  console.log("Setup complete");
  console.log("Master token: bench-master-token.secret123");
  console.log("Sub token: bench-sub-token.secret123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
