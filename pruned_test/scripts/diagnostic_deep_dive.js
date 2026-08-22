const { PrismaClient } = require('@prisma/client');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

function measureTcpRtt(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      const rtt = Date.now() - start;
      socket.destroy();
      resolve(rtt);
    });
    socket.on('error', (err) => resolve(`ERR: ${err.message}`));
    socket.on('timeout', () => { socket.destroy(); resolve('TIMEOUT'); });
  });
}

async function runDiagnostics() {
  console.log('===================================================================');
  console.log('=== PHASE 7: DEEP DIVE DIAGNOSTIC MEASUREMENTS ===');
  console.log('===================================================================\n');

  const host = 'aws-1-eu-west-1.pooler.supabase.com';

  // 1. Measure Raw TCP RTT
  console.log('1. Measuring Network RTT to Supabase (Ireland)...');
  const rtt5432 = await measureTcpRtt(host, 5432);
  const rtt6543 = await measureTcpRtt(host, 6543);
  console.log(`   - TCP Connect to ${host}:5432 (Direct): ${rtt5432} ms`);
  console.log(`   - TCP Connect to ${host}:6543 (PgBouncer): ${rtt6543} ms`);

  // 2. Measure Prisma Cold Connection vs Warm Query Execution
  console.log('\n2. Measuring Prisma Connection Acquisition vs SQL Execution...');
  const prisma = new PrismaClient({
    datasources: { db: { url: env.DIRECT_URL } }
  });

  const tConnectStart = Date.now();
  await prisma.$connect();
  const connectDuration = Date.now() - tConnectStart;
  console.log(`   - Prisma $connect() (Cold TCP+SSL+Auth): ${connectDuration} ms`);

  // Warm Query 1: Simple SELECT 1
  const tQ1Start = Date.now();
  await prisma.$queryRaw`SELECT 1 as ping;`;
  const q1Duration = Date.now() - tQ1Start;
  console.log(`   - Warm Query: SELECT 1 (Network RTT + Postgres Exec): ${q1Duration} ms`);

  // Warm Query 2: Actual ExecutionCommand Poll Query
  const tQ2Start = Date.now();
  const subAccountId = 'DEMO-SUB-1';
  const pollResult = await prisma.$queryRaw`
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
  const q2Duration = Date.now() - tQ2Start;
  console.log(`   - Warm Query: /poll Atomic Claim (UPDATE ... FOR UPDATE SKIP LOCKED): ${q2Duration} ms`);
  console.log(`     Claimed Commands: ${pollResult.length}`);

  // Warm Query 3: Multi-query Master Signal Open Simulation
  console.log('\n3. Measuring Master Signal Simulation (Sequential Queries in Transaction)...');
  const tTxStart = Date.now();
  await prisma.$transaction(async (tx) => {
    const t0 = Date.now();
    await tx.mt5Account.findFirst({ where: { role: 'SUB', isActive: true } });
    const d1 = Date.now() - t0;

    const t1 = Date.now();
    await tx.tradeSignal.findFirst({ orderBy: { time: 'desc' } });
    const d2 = Date.now() - t1;

    const t2 = Date.now();
    await tx.executionCommand.findFirst({ orderBy: { createdAt: 'desc' } });
    const d3 = Date.now() - t2;

    console.log(`     - Tx Step 1 (findAccount): ${d1} ms`);
    console.log(`     - Tx Step 2 (findSignal): ${d2} ms`);
    console.log(`     - Tx Step 3 (findCommand): ${d3} ms`);
  });
  const txDuration = Date.now() - tTxStart;
  console.log(`   - Total Multi-Step Transaction Duration: ${txDuration} ms`);

  // 4. Measure Localhost /poll HTTP Roundtrip from Local API
  console.log('\n4. Measuring Localhost HTTP Endpoint Response (/execution/poll)...');
  const tHttpStart = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:9001/execution/poll', {
      headers: { 'Authorization': 'Bearer sub-token-id.secret123' }
    });
    const body = await res.json();
    const httpDuration = Date.now() - tHttpStart;
    console.log(`   - HTTP GET /execution/poll Total Time: ${httpDuration} ms`);
    console.log(`   - Response Status: ${res.status}, Commands Returned: ${body?.commands?.length ?? 0}`);
  } catch (err) {
    console.error(`   - HTTP Request Failed: ${err.message}`);
  }

  await prisma.$disconnect();
  console.log('\n===================================================================');
}

runDiagnostics().catch(console.error);
