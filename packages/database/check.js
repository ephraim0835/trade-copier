const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const accounts = await prisma.mt5Account.findMany();
  console.log('Accounts:', accounts);
}
main().catch(console.error).finally(() => prisma.$disconnect());
