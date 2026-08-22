const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionCommand"
      (id, "subAccountId", "tradeCopyId", type, symbol, "orderType", volume, price, sl, tp, status, "expiresAt", "createdAt", "updatedAt", "masterSignalId", "masterPositionTicket")
    VALUES
      ('cmd-test-1', 'DEMO-SUB-1', 'copy-1', 'OPEN_ORDER', 'BTCUSDm', 'BUY', 0.02, 0, 0, 0, 'CREATED', NOW() + interval '1 hour', NOW(), NOW(), 'sig-1', 0);
  `);
  console.log('Inserted!');
}
main().finally(() => prisma.$disconnect());
