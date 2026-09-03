const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const signal = await prisma.tradeSignal.findUnique({
    where: { id: '6f38b47c-d143-4531-bf9e-b11c41eda03c' }
  });
  console.log(signal);
}

main().finally(() => prisma.$disconnect());
