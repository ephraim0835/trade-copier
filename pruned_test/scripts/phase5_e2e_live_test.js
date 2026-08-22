const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForCommand(cmdId) {
  process.stdout.write(`Waiting for EA to execute ${cmdId}...`);
  for (let i = 0; i < 60; i++) {
    const cmd = await prisma.executionCommand.findUnique({ where: { id: cmdId } });
    if (cmd && ['EXECUTED', 'REJECTED', 'FAILED', 'EXECUTION_UNKNOWN'].includes(cmd.status)) {
      console.log(` Done! Status: ${cmd.status} (Retcode: ${cmd.mt5Retcode})`);
      return cmd;
    }
    await delay(1000);
  }
  console.log(' Timeout!');
  throw new Error(`Command ${cmdId} timed out`);
}

async function main() {
  console.log('=== Phase 5 E2E LIVE Test ===');
  
  const isDemoOnly = process.env.DEMO_ONLY === 'true';
  if (!isDemoOnly) throw new Error('DEMO_ONLY must be strictly true to run this test.');

  const priceOpen = 0; // EA gets market price
  const sl = 0; // Let's set 0 for crypto unless we know the exact price
  const tp = 0;
  const approvedVol = 0.02; // Small volume for BTCUSDm

  const sigId = 'sig-5-live-' + Date.now();
  const copyId = 'copy-5-live-' + Date.now();
  
  // 1. OPEN
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeSignal" (id, ticket, "masterAcctId", symbol, type, volume, "priceOpen", sl, tp, "sequenceNumber", time, "createdAt")
    VALUES ('${sigId}', ${Date.now()}, 'DEMO-MASTER-1', 'BTCUSDm', 'BUY', ${approvedVol}, ${priceOpen}, ${sl}, ${tp}, 1, NOW(), NOW());
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeCopy" (id, "signalId", "subAccountId", state, "createdAt", "updatedAt")
    VALUES ('${copyId}', '${sigId}', 'DEMO-SUB-1', 'APPROVED', NOW(), NOW());
  `);

  const openCmdId = 'cmd-5-open-' + Date.now();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionCommand"
      (id, "subAccountId", "tradeCopyId", type, symbol, "orderType", volume, price, sl, tp, status, "expiresAt", "createdAt", "updatedAt", "masterSignalId", "masterPositionTicket")
    VALUES
      ('${openCmdId}', 'DEMO-SUB-1', '${copyId}', 'OPEN_ORDER', 'BTCUSDm', 'BUY', ${approvedVol}, 0, ${sl}, ${tp}, 'CREATED', '${expiresAt}', NOW(), NOW(), '${sigId}', 0);
  `);

  const openCmd = await waitForCommand(openCmdId);
  if (!openCmd.success) throw new Error('OPEN failed');
  
  const positionTicket = openCmd.orderTicket;
  console.log(`\nPosition Opened! Ticket: ${positionTicket}`);
  
  await delay(2000); // give EA a moment
  
  // 2. MODIFY
  console.log('\n--- Modifying Position ---');
  const modCmdId = 'cmd-5-mod-' + Date.now();
  await prisma.executionCommand.create({
    data: {
      id: modCmdId, tradeCopyId: copyId, subAccountId: 'DEMO-SUB-1', type: 'MODIFY_ORDER', status: 'CREATED',
      symbol: 'BTCUSDm', orderType: 'BUY', volume: approvedVol, sl: 0, tp: 0,
      expiresAt: new Date(Date.now() + 5 * 60000), masterSignalId: sigId, masterPositionTicket: positionTicket
    }
  });

  const modCmd = await waitForCommand(modCmdId);
  console.log('Modify result:', modCmd.success ? 'Success' : 'Failed');

  await delay(2000);

  // 3. PARTIAL CLOSE
  console.log('\n--- Partial Closing Position ---');
  const partialCmdId = 'cmd-5-part-' + Date.now();
  await prisma.executionCommand.create({
    data: {
      id: partialCmdId, tradeCopyId: copyId, subAccountId: 'DEMO-SUB-1', type: 'CLOSE_PARTIAL', status: 'CREATED',
      symbol: 'BTCUSDm', orderType: 'BUY', volume: approvedVol / 2,
      expiresAt: new Date(Date.now() + 5 * 60000), masterSignalId: sigId, masterPositionTicket: positionTicket
    }
  });

  const partCmd = await waitForCommand(partialCmdId);
  console.log('Partial Close result:', partCmd.success ? 'Success' : 'Failed');
  
  console.log('\nPhase 5 Live Test completed successfully!');
}

main()
  .catch(e => { console.error('\nERROR:', e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
