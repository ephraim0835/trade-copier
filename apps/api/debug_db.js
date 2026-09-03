const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.executionCommand.findMany({where: {masterOrderTicket: 3175358058n}}).then(x => console.dir(x, {depth: null})).finally(() => prisma.$disconnect());
