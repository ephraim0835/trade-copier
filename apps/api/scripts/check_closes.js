const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const commands = await prisma.executionCommand.findMany({
    where: { type: 'CLOSE_ORDER' },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(commands.map(c => c.status + ' | ' + c.mt5Retcode + ' | ' + c.retcodeDescription));
}
main().finally(() => prisma.$disconnect());
