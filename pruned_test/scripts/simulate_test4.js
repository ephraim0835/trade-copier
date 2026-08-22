const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

async function main() {
  console.log('=== Preparing Test 4 Simulation ===');
  
  const fakeTicket = Math.floor(Math.random() * 100000) + 900000000;
  const fakeSignalId = 'sig-test4-' + Date.now();
  const fakeCopyId = 'copy-test4-' + Date.now();

  console.log('1. Inserting mock signal into DB...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeSignal" (id, ticket, "masterAcctId", symbol, type, volume, "priceOpen", sl, tp, "sequenceNumber", time, "createdAt")
    VALUES ('${fakeSignalId}', ${fakeTicket}, 'DEMO-MASTER-1', 'EURUSDm', 'BUY', 0.01, 1.1000, 0, 0, 1, NOW(), NOW());
  `);
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO "TradeCopy" (id, "signalId", "subAccountId", state, "subPositionId", "subOrderTicket", "createdAt", "updatedAt")
    VALUES ('${fakeCopyId}', '${fakeSignalId}', 'DEMO-SUB-1', 'APPROVED', null, null, NOW(), NOW());
  `);

  console.log('2. Signal inserted. subPositionTicket is explicitly NULL.');
  console.log('You should now have multiple EURUSDm positions open on your Sub MT5 terminal.');
  console.log('Press ENTER when you are ready to fire the simulated Master MODIFY event...');

  process.stdin.once('data', () => {
    console.log('Firing POST /master/signal/modify...');
    
    const eaToken = process.env.MASTER_EA_TOKEN || 'master-token-id.secret123';

    const payload = JSON.stringify({
      ticket: fakeTicket.toString(),
      sl: 1.1050,
      tp: 1.1200,
      sequenceNumber: 2
    });

    const options = {
      hostname: 'localhost',
      port: 9001,
      path: '/master/signal/modify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + eaToken,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      console.log('API Response Status:', res.statusCode);
      res.on('data', (d) => process.stdout.write(d));
      res.on('end', () => {
        console.log('\nSimulation command dispatched! Check Sub MT5 Experts log.');
        prisma.$disconnect();
        process.exit(0);
      });
    });

    req.on('error', (e) => {
      console.error('Problem with request:', e.message);
      prisma.$disconnect();
      process.exit(1);
    });

    req.write(payload);
    req.end();
  });
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
