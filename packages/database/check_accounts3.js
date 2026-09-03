const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.mt5Account.findMany({ select: { id: true, login: true, balance: true, equity: true, isActive: true, role: true } });
  console.log(accounts);
}

main().finally(() => prisma.$disconnect());
