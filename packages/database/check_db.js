const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.copySettings.findMany();
  console.log("CopySettings:", settings);
}

main().catch(console.error).finally(() => prisma.$disconnect());
