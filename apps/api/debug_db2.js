const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.mt5Account.findFirst({where: {login: '476719456'}}).then(x => console.dir(x)).finally(() => prisma.$disconnect());
