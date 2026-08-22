const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Starting connection loop test...');
  await prisma.$connect();
  let i = 0;
  while (i < 20) {
    try {
      const start = Date.now();
      await prisma.mt5Account.findFirst();
      console.log(`Query ${i} successful in ${Date.now() - start}ms`);
    } catch (e) {
      console.log(`Query ${i} FAILED:`, e.message);
    }
    await delay(2000);
    i++;
  }
  await prisma.$disconnect();
}
main().catch(console.error);
