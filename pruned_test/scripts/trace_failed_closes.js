const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cutoff = new Date(Date.now() - 1000 * 60 * 60);
  const commands = await prisma.executionCommand.findMany({
    where: { 
      type: 'CLOSE_ORDER',
      status: { not: 'EXECUTED' },
      createdAt: { gt: cutoff }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`Found ${commands.length} failed/unexecuted CLOSE commands.`);
  
  for (const c of commands) {
    console.log(`\n--- Command ID: ${c.id} ---`);
    console.log(`Status: ${c.status}`);
    console.log(`Retcode: ${c.mt5Retcode} | Broker Error: ${c.brokerError} | Comment: ${c.comment}`);
    console.log(`Created: ${c.createdAt?.toISOString()}`);
    console.log(`Expires: ${c.expiresAt?.toISOString()}`);
    console.log(`Delivered: ${c.deliveredAt?.toISOString()}`);
    console.log(`Acknowledged: ${c.acknowledgedAt?.toISOString()}`);
    console.log(`Sub Received: ${c.subReceivedAt?.toISOString()}`);
    console.log(`Sub Acked: ${c.subAcknowledgedAt?.toISOString()}`);
    console.log(`Sub Exec Start: ${c.subExecutionStartedAt?.toISOString()}`);
    console.log(`Sub Exec End: ${c.subExecutionCompletedAt?.toISOString()}`);
    console.log(`Backend Result Rx: ${c.backendResultReceivedAt?.toISOString()}`);
    console.log(`Executed At: ${c.executedAt?.toISOString()}`);
  }
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
