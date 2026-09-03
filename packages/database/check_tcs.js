const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tcs = await prisma.tradeCopy.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(tcs);
}

main().finally(() => prisma.$disconnect());
