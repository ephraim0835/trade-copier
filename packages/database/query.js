const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 3 });
  console.log(users.map(u => ({ id: u.id, email: u.email, passLength: u.password.length, passPrefix: u.password.substring(0, 10) })));
}
main().then(() => prisma.$disconnect());
