const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.accountSnapshot.count();
  console.log('Total snapshots:', count);
  
  const snaps = await prisma.accountSnapshot.findMany({ take: 5 });
  console.log(snaps);
}

main().finally(() => prisma.$disconnect());
