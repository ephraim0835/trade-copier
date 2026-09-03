const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.tradeCopy.count();
  console.log('TradeCopy count:', count);
}

main().finally(() => prisma.$disconnect());
