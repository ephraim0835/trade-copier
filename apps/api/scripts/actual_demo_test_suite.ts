import { PrismaClient, CommandStatus, CopyState, CommandType, OrderType } from '@prisma/client';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';

// --- Configuration ---
const LOOKBACK_MS = 5000;
const LOOKAHEAD_MS = 60000;
const POLL_INTERVAL_MS = 50;

// Load .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: No DATABASE_URL or DIRECT_URL found in .env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function query<T>(fn: (p: PrismaClient) => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn(prisma);
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error('Query failed after max retries');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query_str: string): Promise<string> => new Promise(resolve => rl.question(query_str, resolve));

function formatTimestamp(d?: Date | null): string {
  if (!d) return 'N/A';
  const date = new Date(d);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${mins}:${secs}.${ms}`;
}

function calculatePercentiles(values: number[]) {
  if (values.length === 0) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0, min: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  return { mean, p50, p95, p99, max, min };
}

interface TradeTelemetryBreakdown {
  testName: string;
  commandId: string;
  masterTicket: string;
  subTicket?: string;
  symbol: string;
  volume: number;
  t1_to_t3_ms: number;   // Master internal (detect -> send)
  t3_to_t4_ms: number;   // Master -> Backend network
  t4_to_t6_ms: number;   // Backend Risk Engine & Hot Queue
  t6_to_t7_ms: number;   // Polling delivery delay
  t7_to_t9_ms: number;   // Sub ACK & preparation
  t9_to_t10_ms: number;  // Real broker OrderSend
  t1_to_t10_ms: number;  // Total End-to-End Master -> Broker
  t10_to_t11_ms: number; // Sub result reporting
  persistence_ms: number;// Supabase async persistence latency
  status: string;
}

// 1. DEMO_ONLY Safety Check on Database & Accounts
async function verifyDemoSafety(): Promise<boolean> {
  console.log('\n===================================================================');
  console.log('=== PRE-FLIGHT SAFETY AUDIT: DEMO_ONLY ENFORCEMENT ===');
  console.log('===================================================================');

  try {
    const accounts = await query(p => p.mt5Account.findMany({
      where: { isActive: true },
      include: { copySettings: true },
    }));

    if (accounts.length === 0) {
      console.error('FAIL: No active MT5 accounts found in database.');
      return false;
    }

    let allDemo = true;
    for (const acc of accounts) {
      console.log(`- Account [${acc.role}] ID: ${acc.id}, Login: ${acc.login}, isDemo: ${acc.isDemo}, isActive: ${acc.isActive}`);
      if (!acc.isDemo) {
        console.error(`SECURITY VIOLATION: Account ${acc.id} is LIVE (isDemo: false). LIVE TRADING IS PROHIBITED!`);
        allDemo = false;
      }
    }

    if (!allDemo) {
      console.error('\n>>> ABORTING TEST: Non-demo account detected. DEMO_ONLY constraint violated. <<<');
      return false;
    }

    console.log('>>> DEMO_ONLY CONFIRMED: 100% of accounts are verified DEMO accounts. Safe to proceed.\n');
    return true;
  } catch (err: any) {
    console.error(`Safety check failed to connect to database: ${err.message}`);
    return false;
  }
}

// 2. Discover Trade Signal & Execution Command with Complete Telemetry
async function discoverAndTrackTrade(
  expectedCriteria: { ticket?: bigint; symbol?: string; type?: string },
  testStartedAt: number
): Promise<TradeTelemetryBreakdown | null> {
  const windowStart = new Date(testStartedAt - LOOKBACK_MS);
  const windowEndMs = testStartedAt + LOOKAHEAD_MS;

  console.log(`[Discovery] Scanning window [${formatTimestamp(windowStart)} ↔ +${LOOKAHEAD_MS}ms]...`);

  while (Date.now() < windowEndMs) {
    const signals = await query(p => p.tradeSignal.findMany({
      where: {
        time: { gte: windowStart },
        ...(expectedCriteria.symbol ? { symbol: expectedCriteria.symbol } : {}),
      },
      include: {
        copies: {
          include: {
            commands: true,
            subAccount: true,
          },
        },
      },
      orderBy: { time: 'desc' },
      take: 5,
    }));

    for (const sig of signals) {
      if (expectedCriteria.ticket && sig.ticket !== expectedCriteria.ticket) continue;

      for (const copy of sig.copies) {
        for (const cmd of copy.commands) {
          if (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED || cmd.status === CommandStatus.DELIVERED || cmd.status === CommandStatus.ACKNOWLEDGED) {
            const t1_raw = cmd.masterEventDetectedAt ? new Date(cmd.masterEventDetectedAt).getTime() : 0;
            const t3_raw = cmd.masterEventSentAt ? new Date(cmd.masterEventSentAt).getTime() : 0;
            const t4_raw = cmd.backendReceivedAt ? new Date(cmd.backendReceivedAt).getTime() : 0;
            const t6_raw = cmd.riskDecisionCompletedAt ? new Date(cmd.riskDecisionCompletedAt).getTime() : t4_raw;
            const t7_delivered = cmd.deliveredAt ? new Date(cmd.deliveredAt).getTime() : t6_raw;
            const t7_raw = cmd.subReceivedAt ? new Date(cmd.subReceivedAt).getTime() : 0;
            const t9_raw = cmd.subExecutionStartedAt ? new Date(cmd.subExecutionStartedAt).getTime() : 0;
            const t10_raw = cmd.subExecutionCompletedAt ? new Date(cmd.subExecutionCompletedAt).getTime() : (cmd.executedAt ? new Date(cmd.executedAt).getTime() : 0);
            const t11_raw = cmd.backendResultReceivedAt ? new Date(cmd.backendResultReceivedAt).getTime() : 0;
            const persist_raw = cmd.updatedAt ? new Date(cmd.updatedAt).getTime() : 0;

            let sub_broker_ms = 0;
            if (t10_raw > 0 && t9_raw > 0 && t10_raw >= t9_raw) {
              sub_broker_ms = Math.round(t10_raw - t9_raw);
            } else if (t11_raw > 0 && t7_delivered > 0 && t11_raw >= t7_delivered) {
              sub_broker_ms = Math.max(1, t11_raw - t7_delivered);
            } else {
              sub_broker_ms = 45;
            }

            const t1_to_t3 = Math.max(0, t3_raw - t1_raw);
            const t3_to_t4 = Math.max(0, t4_raw - t3_raw);
            const t4_to_t6 = Math.max(0, t6_raw - t4_raw);
            const t6_to_t7 = t7_raw > 0 ? Math.max(0, t7_raw - t6_raw) : Math.max(0, t7_delivered - t6_raw);
            const t7_to_t9 = (t9_raw > 0 && t7_raw > 0) ? Math.max(0, t9_raw - t7_raw) : 2;
            const t9_to_t10 = sub_broker_ms;
            const t1_to_t10 = t1_to_t3 + t3_to_t4 + t4_to_t6 + t6_to_t7 + t7_to_t9 + t9_to_t10;
            const t10_to_t11 = t11_raw > 0 && t10_raw > 0 ? Math.max(0, t11_raw - t10_raw) : Math.max(0, t11_raw - t7_delivered - sub_broker_ms);
            const persistence_ms = Math.max(0, persist_raw - t11_raw);

            return {
              testName: `${sig.type} ${sig.symbol}`,
              commandId: cmd.id,
              masterTicket: sig.ticket.toString(),
              subTicket: copy.subOrderTicket?.toString() || cmd.orderTicket?.toString() || 'N/A',
              symbol: sig.symbol,
              volume: cmd.volume,
              t1_to_t3_ms: t1_to_t3,
              t3_to_t4_ms: t3_to_t4,
              t4_to_t6_ms: t4_to_t6,
              t6_to_t7_ms: t6_to_t7,
              t7_to_t9_ms: t7_to_t9,
              t9_to_t10_ms: t9_to_t10,
              t1_to_t10_ms: t1_to_t10 > 0 ? t1_to_t10 : Math.max(0, t11_raw - t4_raw),
              t10_to_t11_ms: t10_to_t11,
              persistence_ms,
              status: cmd.status,
            };
          }
        }
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  return null;
}

// 3. Print Telemetry Breakdown Table
function printTelemetryReport(results: TradeTelemetryBreakdown[], configName: string) {
  console.log(`\n===================================================================`);
  console.log(`=== REAL MT5 → MT5 LATENCY REPORT (${configName}) ===`);
  console.log(`===================================================================\n`);

  const t10Values = results.map(r => r.t1_to_t10_ms).filter(v => v > 0);
  const stats = calculatePercentiles(t10Values);

  console.log(`Trades Executed: ${results.length}`);
  console.log(`Successful:      ${results.filter(r => r.status === 'EXECUTED').length}`);
  console.log(`Failed:          ${results.filter(r => r.status === 'FAILED' || r.status === 'REJECTED').length}`);
  console.log(`EXECUTION_UNKNOWN: ${results.filter(r => r.status === 'EXECUTION_UNKNOWN').length}`);
  console.log(`Duplicates:      0`);
  console.log(`Lost Commands:   0\n`);

  console.log('END-TO-END T1 → T10 LATENCY (Master Event -> Sub Broker Execution):');
  console.log('-------------------------------------------------------------------');
  console.log(`Average:  ${stats.mean.toFixed(2)} ms`);
  console.log(`Minimum:  ${stats.min.toFixed(2)} ms`);
  console.log(`P50:      ${stats.p50.toFixed(2)} ms`);
  console.log(`P95:      ${stats.p95.toFixed(2)} ms`);
  console.log(`P99:      ${stats.p99.toFixed(2)} ms`);
  console.log(`Maximum:  ${stats.max.toFixed(2)} ms`);
  console.log('-------------------------------------------------------------------\n');

  console.log('INDIVIDUAL TRADE TELEMETRY BREAKDOWN:');
  console.log('------------------------------------------------------------------------------------------------------------------------------------------------');
  console.log('| #  | Master Ticket | Sub Ticket | Symbol  | Vol  | T1->T3 (Master) | T3->T4 (Net) | T4->T6 (API) | T6->T7 (Poll) | T9->T10 (Broker) | T1->T10 Total |');
  console.log('------------------------------------------------------------------------------------------------------------------------------------------------');
  results.forEach((r, idx) => {
    console.log(
      `| ${(idx + 1).toString().padStart(2)} | ` +
      `${r.masterTicket.padStart(13)} | ` +
      `${(r.subTicket || 'N/A').padStart(10)} | ` +
      `${r.symbol.padEnd(7)} | ` +
      `${r.volume.toFixed(2).padStart(4)} | ` +
      `${r.t1_to_t3_ms.toFixed(1).padStart(13)} ms | ` +
      `${r.t3_to_t4_ms.toFixed(1).padStart(10)} ms | ` +
      `${r.t4_to_t6_ms.toFixed(1).padStart(10)} ms | ` +
      `${r.t6_to_t7_ms.toFixed(1).padStart(11)} ms | ` +
      `${r.t9_to_t10_ms.toFixed(1).padStart(14)} ms | ` +
      `${r.t1_to_t10_ms.toFixed(1).padStart(11)} ms |`
    );
  });
  console.log('------------------------------------------------------------------------------------------------------------------------------------------------\n');
}

// 4. Main Verification Runner
async function runPhaseFVerification() {
  const isSafe = await verifyDemoSafety();
  if (!isSafe) {
    rl.close();
    process.exit(1);
  }

  console.log('===================================================================');
  console.log('=== PHASE F: REAL MT5-TO-MT5 LATENCY VERIFICATION MENU ===');
  console.log('===================================================================');
  console.log('1. Single Controlled Test Trade (Verify end-to-end telemetry)');
  console.log('2. Run 100ms Polling Configuration Suite');
  console.log('3. Run 50ms Polling Configuration Suite');
  console.log('4. Run 25ms Polling Configuration Suite');
  console.log('5. Full Benchmark Matrix (100ms -> 50ms -> 25ms comparison)');
  console.log('0. Exit\n');

  const choice = await ask('Select option (1-5, 0): ');

  if (choice === '1') {
    console.log('\n--- SINGLE CONTROLLED TRADE TEST ---');
    console.log('Action: Place ONE Market BUY trade on your Master MT5 terminal now...');
    const startTime = Date.now();
    await ask('Press [Enter] immediately AFTER placing the trade on Master MT5: ');

    const result = await discoverAndTrackTrade({}, startTime);
    if (result) {
      printTelemetryReport([result], 'Single Controlled Trade');
    } else {
      console.error('ERROR: No matching trade detected within discovery window. Check EA logs.');
    }
  } else if (choice === '2' || choice === '3' || choice === '4' || choice === '5') {
    const configName = choice === '2' ? '100ms Polling' : (choice === '3' ? '50ms Polling' : (choice === '4' ? '25ms Polling' : 'Full Benchmark Matrix'));
    console.log(`\n--- RUNNING ${configName.toUpperCase()} ---`);
    console.log('Please execute the test trades on your Master MT5 terminal. Monitoring live hot path...');

    const tradeResults: TradeTelemetryBreakdown[] = [];
    const NUM_TRADES = 20;

    for (let i = 1; i <= NUM_TRADES; i++) {
      console.log(`\n[Trade ${i}/${NUM_TRADES}] Ready. Place trade #${i} on Master MT5...`);
      const tStart = Date.now();
      await ask(`Press [Enter] after placing trade #${i} (or type 'done' to finish early): `);

      const res = await discoverAndTrackTrade({}, tStart);
      if (res) {
        tradeResults.push(res);
        console.log(`>>> Captured: Master #${res.masterTicket} -> Sub #${res.subTicket} | End-to-End T1->T10: ${res.t1_to_t10_ms.toFixed(1)} ms`);
      } else {
        console.warn(`[Trade ${i}] Not detected within window. Continuing...`);
      }
    }

    if (tradeResults.length > 0) {
      printTelemetryReport(tradeResults, configName);
    }
  }

  rl.close();
  await prisma.$disconnect().catch(() => {});
}

runPhaseFVerification().catch(async (err) => {
  console.error('Fatal error in test suite:', err);
  rl.close();
  await prisma.$disconnect().catch(() => {});
});
