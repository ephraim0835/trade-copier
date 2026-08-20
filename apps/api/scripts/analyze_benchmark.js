const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function percentiles(arr) {
  if (arr.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    avg: (sum / sorted.length).toFixed(2),
    p50: sorted[Math.floor(sorted.length * 0.50)].toFixed(2),
    p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
    max: sorted[sorted.length - 1].toFixed(2)
  };
}

async function main() {
  const commands = await prisma.executionCommand.findMany({
    where: { type: 'OPEN_ORDER' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { 
      status: true,
      mt5Retcode: true,
      createdAt: true,
      subReceivedAt: true,
      subAcknowledgedAt: true,
      subExecutionStartedAt: true,
      subExecutionCompletedAt: true,
      backendResultReceivedAt: true,
    }
  });

  const totals = [];
  const dispatches = [];
  const polls = [];
  const execs = [];
  let failures = 0;
  let unknown = 0;
  let error1003 = 0;
  
  commands.forEach(c => {
    if (c.status === 'REJECTED' || c.status === 'FAILED') failures++;
    if (c.status === 'EXECUTION_UNKNOWN') unknown++;
    if (c.mt5Retcode === 1003 || c.mt5Retcode === 5203) error1003++;
    
    if (c.subExecutionCompletedAt && c.createdAt) {
      totals.push(c.subExecutionCompletedAt.getTime() - c.createdAt.getTime());
    }
    if (c.subReceivedAt && c.createdAt) {
      dispatches.push(c.subReceivedAt.getTime() - c.createdAt.getTime());
    }
    if (c.subAcknowledgedAt && c.subReceivedAt) {
      polls.push(c.subAcknowledgedAt.getTime() - c.subReceivedAt.getTime());
    }
    if (c.subExecutionCompletedAt && c.subExecutionStartedAt) {
      execs.push(c.subExecutionCompletedAt.getTime() - c.subExecutionStartedAt.getTime());
    }
  });

  console.log('=== Benchmark Data (Last 30 mins) ===');
  console.log(`Total Trades Analyzed (OPEN_ORDER): ${commands.length}`);
  console.log(`Successes: ${commands.length - failures - unknown}`);
  console.log(`Failures: ${failures}`);
  console.log(`Unknowns: ${unknown}`);
  console.log(`Error 1003/5203: ${error1003}`);
  
  console.log('\n--- Latency Breakdown (ms) ---');
  console.log('Total Time (API -> Broker):', percentiles(totals));
  console.log('Master Dispatch (API Wait):', percentiles(dispatches));
  console.log('Polling Wait (Network):    ', percentiles(polls));
  console.log('Sub Execution (Broker):    ', percentiles(execs));
  
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
