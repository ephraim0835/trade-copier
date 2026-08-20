
const { performance } = require('perf_hooks');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://127.0.0.1:9001/execution';
let MASTER_TOKEN = '';
let SUB_TOKEN = '';

const INTERVALS = [100, 50, 25];
const NUM_REQUESTS = 50; // Burst size

async function runBenchmark(intervalMs) {
  console.log(`\n=== Starting Benchmark at ${intervalMs}ms polling interval ===`);
  
  let commandsReceived = 0;
  let commandsSent = 0;
  const latencies = [];
  let isPolling = true;

  // Polling loop
  const pollInterval = setInterval(async () => {
    if (!isPolling) return;
    try {
      const pollStart = performance.now();
      const res = await fetch(`${API_URL}/poll`, {
        headers: { 'Authorization': `Bearer ${SUB_TOKEN}` },
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
      if (data && data.commands && data.commands.length > 0) {
        for (const cmd of data.commands) {
          const receivedAt = performance.now();
          const sentAt = cmd.masterEventDetectedAt ? new Date(cmd.masterEventDetectedAt).getTime() : 0;
          if (sentAt) {
            latencies.push(Date.now() - sentAt); // Approximation
          }
          commandsReceived++;
          
          // Ack
          await fetch(`${API_URL}/ack`, { 
            method: 'POST',
            body: JSON.stringify({ commandId: cmd.id }),
            headers: { 'Authorization': `Bearer ${SUB_TOKEN}`, 'Content-Type': 'application/json' }
          });
          
          // Result
          await fetch(`${API_URL}/result`, {
            method: 'POST',
            body: JSON.stringify({
            commandId: cmd.id,
            success: true,
            retcode: 0,
            orderTicket: '99999',
            executedVolume: cmd.volume,
            subReceivedAt: receivedAt,
            subAcknowledgedAt: receivedAt + 5,
            subExecutionStartedAt: receivedAt + 10,
            subExecutionCompletedAt: receivedAt + 15,
            timestamp: new Date().toISOString()
          }), headers: { 'Authorization': `Bearer ${SUB_TOKEN}`, 'Content-Type': 'application/json' } });
        }
      }
      }
    } catch (e) {
      if (e.name !== 'TimeoutError' && !e.message?.includes('ECONNREFUSED')) {
         // Silently handle to simulate MT5 1003 or timeouts
      }
    }
  }, intervalMs);

  // Send Burst
  await new Promise(r => setTimeout(r, 1000));
  console.log(`Sending burst of ${NUM_REQUESTS} master signals...`);
  
  const promises = [];
  for(let i=0; i<NUM_REQUESTS; i++) {
    const sequenceNumber = Date.now() * 1000 + i;
    promises.push(
      fetch(`${API_URL}/master/signal`, {
        method: 'POST',
        body: JSON.stringify({
        ticket: (100000 + i).toString(),
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 1.0,
        priceOpen: 1.1,
        sl: 0,
        tp: 0,
        sequenceNumber,
        detectedAt: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
        sentAt: new Date().toISOString()
      }),
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}`, 'Content-Type': 'application/json' }
      }).then(() => commandsSent++).catch(e => console.log('Master send error'))
    );
  }
  
  await Promise.all(promises);
  console.log(`Master finished sending ${commandsSent} signals.`);
  
  // Wait for delivery
  let timeout = 100; // 10s wait
  while (commandsReceived < commandsSent && timeout > 0) {
    await new Promise(r => setTimeout(r, 100));
    timeout--;
  }
  
  isPolling = false;
  clearInterval(pollInterval);
  
  if (latencies.length === 0) {
    console.log(`No commands received or mapped. Failed.`);
    return;
  }
  
  latencies.sort((a,b) => a - b);
  const sum = latencies.reduce((a,b) => a+b, 0);
  const avg = sum / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const max = latencies[latencies.length - 1];

  console.log(`Results for ${intervalMs}ms:`);
  console.log(`Sent: ${commandsSent} | Received: ${commandsReceived}`);
  console.log(`Avg: ${avg.toFixed(2)}ms`);
  console.log(`P50: ${p50}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms`);
  console.log(`Max: ${max}ms`);
  
  return { avg, p50, p95, p99, max, commandsReceived, commandsSent };
}

async function main() {
  console.log("Fetching tokens from DB...");
  const masterToken = await prisma.eaToken.findFirst({ where: { mt5Account: { id: 'master-demo-1' } } });
  const subToken = await prisma.eaToken.findFirst({ where: { mt5Account: { id: 'sub-demo-1' } } });
  
  if (!masterToken || !subToken) {
     console.error("Tokens not found! Run the API tests first to populate the DB.");
     process.exit(1);
  }
  
  // Actually we need the secret. Since the tests use hardcoded secrets...
  // Let's just use the known secret from e2e-demo.spec.ts
  MASTER_TOKEN = masterToken.id + '.secret123';
  SUB_TOKEN = subToken.id + '.secret123';

  console.log("Starting Polling Interval Benchmarks...");
  for (const interval of INTERVALS) {
    await runBenchmark(interval);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("\nBenchmarks complete.");
  await prisma.$disconnect();
  process.exit(0);
}

main();
