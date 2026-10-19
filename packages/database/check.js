const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tickets = await prisma.supportTicket.findMany();
  console.log('Tickets count:', tickets.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
