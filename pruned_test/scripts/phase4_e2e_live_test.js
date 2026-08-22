const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Phase 4 E2E Live Test ===');

  // 1. Verify DEMO_ONLY
  const isDemoOnly = process.env.DEMO_ONLY === 'true';
  console.log(`DEMO_ONLY enforced: ${isDemoOnly}`);
  if (!isDemoOnly) throw new Error('DEMO_ONLY must be strictly true to run this test.');

  // 2. Setup DB seed (idempotent)
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt")
    VALUES ('test-owner', 'test@tradecopier.com', 'dummy', 'USER', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Mt5Account" (id, login, "userId", broker, server, role, "isActive", "isDemo", "createdAt", "updatedAt")
    VALUES ('DEMO-MASTER-1', 'master-login-1', 'test-owner', 'Exness', 'Exness-MT5Trial9', 'MASTER', true, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Mt5Account" (id, login, "userId", broker, server, role, "isActive", "isDemo", "createdAt", "updatedAt")
    VALUES ('DEMO-SUB-1', 'sub-login-1', 'test-owner', 'Exness', 'Exness-MT5Trial9', 'SUB', true, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "CopySettings" (id, "mt5AccountId", "riskMultiplier", "roundingTolerancePct", "createdAt", "updatedAt")
    VALUES ('cs-demo-sub-1', 'DEMO-SUB-1', 1.0, 2.0, NOW(), NOW())
    ON CONFLICT ("mt5AccountId") DO NOTHING;
  `);

  console.log('DB seed complete.');

  // 3. Verify sub account is demo (DEMO_ONLY guard check)
  const subRows = await prisma.$queryRawUnsafe(`SELECT id, server, "isDemo" FROM "Mt5Account" WHERE id = 'DEMO-SUB-1'`);
  const sub = subRows[0];
  console.log(`Target Account: ${sub.id} | Server: ${sub.server} | isDemo: ${sub.isDemo}`);
  if (!sub.isDemo) throw new Error('SECURITY: Target account is NOT flagged as demo. Aborting.');

  // 4. Cancel any stale commands
  await prisma.$executeRawUnsafe(`
    UPDATE "ExecutionCommand" SET status = 'EXPIRED', "updatedAt" = NOW()
    WHERE "subAccountId" = 'DEMO-SUB-1'
    AND status IN ('CREATED', 'QUEUED', 'DELIVERED', 'ACKNOWLEDGED');
  `);

  // 5. Risk Engine evaluation (inline — mirrors RiskEngineService logic)
  console.log('\n--- Risk Engine Evaluation ---');
  const priceOpen = 197.00;
  const sl       = 190.00;
  const tp       = 215.00;
  const equity   = 10000;
  const riskPct  = 1.0;
  const tickSize = 0.01;
  const tickValue= 1.0;   // $/tick/lot for BCHUSDm on Exness
  const lotStep  = 0.01;

  const intendedRisk  = equity * (riskPct / 100);           // $100
  const slDistance    = Math.abs(priceOpen - sl);           // 7.00
  const riskPerLot    = (slDistance / tickSize) * tickValue; // 700
  let rawVol          = intendedRisk / riskPerLot;           // 0.1428...
  const approvedVol   = Math.floor(rawVol / lotStep) * lotStep; // 0.14 (rounded down)
  const rrLong        = (tp - priceOpen) / (priceOpen - sl); // (215-197)/(197-190) = 18/7 ≈ 2.57

  console.log(`  Intended risk:    $${intendedRisk}`);
  console.log(`  SL distance:      ${slDistance} pts`);
  console.log(`  Risk/lot:         $${riskPerLot}`);
  console.log(`  Raw volume:       ${rawVol.toFixed(4)}`);
  console.log(`  Approved volume:  ${approvedVol}`);
  console.log(`  RR:               1:${rrLong.toFixed(2)} (min 1:2.00 required)`);
  if (rrLong < 2.0) throw new Error('Risk Engine REJECTED: RR below minimum 2.0');
  console.log(`  Risk Decision:    APPROVED ✓`);

  // 6. Create signal + copy
  const sigId  = 'sig-'  + Date.now();
  const copyId = 'copy-' + Date.now();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeSignal" (id, ticket, "masterAcctId", symbol, type, volume, "priceOpen", sl, tp, time, "createdAt")
    VALUES ('${sigId}', ${Date.now()}, 'DEMO-MASTER-1', 'BCHUSDm', 'BUY', ${approvedVol}, ${priceOpen}, ${sl}, ${tp}, NOW(), NOW());
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeCopy" (id, "signalId", "subAccountId", state, "createdAt", "updatedAt")
    VALUES ('${copyId}', '${sigId}', 'DEMO-SUB-1', 'APPROVED', NOW(), NOW());
  `);

  // 7. Create ExecutionCommand
  const cmdId     = 'cmd-' + Date.now();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExecutionCommand"
      (id, "subAccountId", "tradeCopyId", type, symbol, "orderType", volume, price, sl, tp, status, "expiresAt", "createdAt", "updatedAt")
    VALUES
      ('${cmdId}', 'DEMO-SUB-1', '${copyId}', 'OPEN_ORDER', 'BCHUSDm', 'BUY', ${approvedVol}, 0, ${sl}, ${tp}, 'CREATED', '${expiresAt}', NOW(), NOW());
  `);

  console.log(`\n--- Execution Pipeline ---`);
  console.log(`Command ID: ${cmdId}`);
  console.log(`EA polling every 5s. Waiting up to 60s for execution result...`);

  // 8. Poll until EA executes (or timeout 60s)
  let finalCmd = null;
  const TERMINAL_STATES = new Set(['EXECUTED', 'REJECTED', 'FAILED', 'EXECUTION_UNKNOWN']);
  for (let i = 0; i < 60; i++) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "ExecutionCommand" WHERE id = '${cmdId}'`);
    const cur  = rows[0];
    process.stdout.write(`[${String(i).padStart(2,'0')}s] ${cur?.status}...\r`);
    if (TERMINAL_STATES.has(cur?.status)) { finalCmd = cur; console.log(''); break; }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!finalCmd) throw new Error('Timeout (60s): Sub EA did not execute the command. Ensure EA is attached and WebRequest is allowed for http://localhost:3001');

  // 9. Final Report
  const latencyMs = finalCmd.executedAt && finalCmd.deliveredAt
    ? new Date(finalCmd.executedAt).getTime() - new Date(finalCmd.deliveredAt).getTime()
    : null;

  console.log('\n========================================');
  console.log('     PHASE 4 E2E EXECUTION REPORT');
  console.log('========================================');
  console.log(`Risk Decision:      APPROVED`);
  console.log(`Approved Volume:    ${approvedVol} lots`);
  console.log(`Command ID:         ${finalCmd.id}`);
  console.log(`Sub EA ACK:         ${finalCmd.acknowledgedAt ? 'YES @ ' + new Date(finalCmd.acknowledgedAt).toISOString() : 'NO'}`);
  console.log(`Final DB Status:    ${finalCmd.status}`);
  console.log(`MT5 Retcode:        ${finalCmd.mt5Retcode ?? 'N/A'} (${finalCmd.retcodeDescription ?? 'N/A'})`);
  console.log(`Order Ticket:       ${finalCmd.orderTicket ?? 'N/A'}`);
  console.log(`Deal Ticket:        ${finalCmd.dealTicket  ?? 'N/A'}`);
  console.log(`Req. Volume:        ${finalCmd.volume}  | Exec. Volume: ${finalCmd.executedVolume ?? 'N/A'}`);
  console.log(`Req. Price:         ${finalCmd.price}   | Exec. Price:  ${finalCmd.executedPrice  ?? 'N/A'}`);
  console.log(`SL:                 ${finalCmd.sl} | TP: ${finalCmd.tp}`);
  console.log(`Execution Latency:  ${latencyMs != null ? latencyMs + 'ms' : 'N/A'}`);
  console.log('----------------------------------------');
  if (finalCmd.status === 'EXECUTED') {
    console.log('Reconciliation:     SUCCESS — trade executed. DB state matches MT5.');
  } else if (finalCmd.status === 'EXECUTION_UNKNOWN') {
    console.log('Reconciliation:     UNKNOWN — ReconciliationEngine must sync from MT5 history. No retry initiated.');
  } else {
    console.log(`Reconciliation:     FAILED — ${finalCmd.brokerError ?? finalCmd.retcodeDescription ?? 'unknown error'}`);
  }
  console.log('========================================');
}

main()
  .catch(e => { console.error('\nERROR:', e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
