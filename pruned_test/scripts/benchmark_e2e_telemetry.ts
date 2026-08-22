import { PrismaClient, CommandStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function runBenchmark() {
  console.log('--- 11-STAGE E2E TELEMETRY SIMULATION ---');
  console.log('Validating Atomic Polling...');
  
  // Create a command
  const subAccountId = (await prisma.mt5Account.findFirst({ where: { role: 'SUB' } }))?.id;
  if (!subAccountId) {
    console.error('No SUB account found');
    return;
  }
  
  const tradeCopy = await prisma.tradeCopy.findFirst({ where: { subAccountId } });
  if (!tradeCopy) {
      console.error('No TradeCopy found');
      return;
  }
  
  const cmd = await prisma.executionCommand.create({
    data: {
      tradeCopyId: tradeCopy.id,
      subAccountId,
      status: CommandStatus.CREATED,
      type: 'OPEN_ORDER',
      symbol: 'EURUSD',
      orderType: 'BUY',
      volume: 1.0,
      expiresAt: new Date(Date.now() + 60000),
    }
  });

  console.log(`Created command ${cmd.id} for atomic poll test.`);

  // Fire 10 concurrent requests to simulate EA polling race condition
  const startPollTime = Date.now();
  const pollPromises = [];
  for (let i = 0; i < 10; i++) {
    pollPromises.push(
      prisma.$queryRaw`
        UPDATE "ExecutionCommand"
        SET status = 'DELIVERED', "deliveredAt" = NOW()
        WHERE id IN (
          SELECT id FROM "ExecutionCommand"
          WHERE "subAccountId" = ${subAccountId}
            AND status IN ('CREATED', 'QUEUED')
            AND "expiresAt" > NOW()
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `
    );
  }

  const results = await Promise.all(pollPromises);
  const endPollTime = Date.now();
  
  let claimedCount = 0;
  for (const res of results) {
    if (Array.isArray(res) && res.length > 0) {
      claimedCount++;
    }
  }

  console.log(`Fired 10 concurrent /poll requests in ${endPollTime - startPollTime}ms.`);
  console.log(`Commands claimed by concurrent requests: ${claimedCount} (Expected: 1)`);
  if (claimedCount !== 1) {
    console.error('ATOMIC POLLING FAILED!');
  } else {
    console.log('ATOMIC POLLING VERIFIED SUCCESSFULLY.');
  }

  // Next, let's test invalid transition from EXECUTION_UNKNOWN -> DELIVERED
  console.log('\n--- VERIFYING INVALID STATE TRANSITIONS ---');
  await prisma.executionCommand.update({
    where: { id: cmd.id },
    data: { status: CommandStatus.EXECUTION_UNKNOWN }
  });

  try {
    const pollAgain = await prisma.$queryRaw`
        UPDATE "ExecutionCommand"
        SET status = 'DELIVERED', "deliveredAt" = NOW()
        WHERE id IN (
          SELECT id FROM "ExecutionCommand"
          WHERE "subAccountId" = ${subAccountId}
            AND status IN ('CREATED', 'QUEUED')
            AND "expiresAt" > NOW()
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `;
    
    // @ts-ignore
    if (pollAgain.length === 0) {
       console.log('EXECUTION_UNKNOWN command is NOT claimable by /poll. Transition prevented.');
    } else {
       console.error('EXECUTION_UNKNOWN command was claimed! FAILED.');
    }
  } catch (e) {
    console.error('Error in transition test', e);
  }

  console.log('\n--- MOCK LATENCY RESULTS ---');
  console.log(`T1 (Master Detection) -> T2 (Queue) : ~1ms (Simulated native MQL5)`);
  console.log(`T2 (Queue) -> T3 (Socket/HTTP send): ~0.2ms (Simulated)`);
  console.log(`T3 -> T4 (Network -> API Receive): ~1ms (Localhost mock)`);
  console.log(`T4 -> T5 (Risk Engine / Prisma): ~2-4ms (Measured in previous backend benchmark)`);
  console.log(`T5 -> T6 (Sub EA Polling interval): 25ms-100ms (Configurable via SubCopier)`);
  console.log(`T6 -> T7 (API delivery): ~1ms`);
  console.log(`T7 -> T8 (Sub EA ACK): ~1ms`);
  console.log(`T8 -> T9 (OrderSend execution): ~5-15ms (Broker execution latency)`);
  console.log(`T9 -> T10 (Sub EA result tx): ~1ms`);
  console.log(`T10 -> T11 (API saves result): ~2ms`);

  console.log('\nNOTE: Actual MT5-to-MT5 network measurements require deploying the EA to a live/demo server, as WebRequest loopback overhead differs from external networks.');

  await prisma.executionCommand.delete({ where: { id: cmd.id } });
  
  process.exit(0);
}

runBenchmark().catch(console.error);
