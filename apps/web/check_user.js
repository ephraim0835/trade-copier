const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'possibleplaiz16@gmail.com' } });
  console.log('USER EXISTS:', !!user);
  if (user) {
    console.log('EMAIL VERIFIED:', user.emailVerified);
  }
}
main().finally(() => prisma.$disconnect());
