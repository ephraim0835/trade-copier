import { HotDispatchService, HotCommandData } from '../src/modules/execution/services/hot-dispatch.service';
import { CommandStatus, CommandType, OrderType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

function calculatePercentiles(values: number[]) {
  if (values.length === 0) return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  return { mean, p50, p95, p99, max };
}

async function runHotPathBenchmark() {
  console.log('===================================================================');
  console.log('=== PHASE B/C: IN-MEMORY HOT PATH PERFORMANCE BENCHMARK ===');
  console.log('===================================================================\n');

  const journalDir = path.join(process.cwd(), 'data');
  const journalFile = path.join(journalDir, 'hot_command_journal.jsonl');
  if (fs.existsSync(journalFile)) {
    try { fs.unlinkSync(journalFile); } catch (e) {}
  }

  const service = new HotDispatchService();
  await service.onModuleInit();

  const ITERATIONS = 1000;
  const enqueueTimes: number[] = [];
  const pollTimes: number[] = [];
  const ackTimes: number[] = [];
  const resultTimes: number[] = [];

  console.log(`Running ${ITERATIONS} iterations of the hot-path lifecycle...\n`);

  for (let i = 1; i <= ITERATIONS; i++) {
    const cmd: HotCommandData = {
      id: `bench-cmd-${i}`,
      tradeCopyId: `copy-${i}`,
      subAccountId: 'DEMO-SUB-1',
      masterAccountId: 'DEMO-MASTER-1',
      type: CommandType.OPEN_ORDER,
      status: CommandStatus.CREATED,
      symbol: 'BTCUSDm',
      orderType: OrderType.BUY,
      volume: 0.1,
      sl: 64500,
      tp: 65500,
      sequenceNumber: i,
      masterSignalId: `sig-${i}`,
      masterOrderTicket: BigInt(30000000 + i),
      masterPositionTicket: BigInt(30000000 + i),
      hotPathCommandAvailableAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 1. Enqueue (Master /open hot path)
    const t0 = process.hrtime.bigint();
    await service.enqueueCommand(cmd);
    const t1 = process.hrtime.bigint();
    enqueueTimes.push(Number(t1 - t0) / 1e6); // Convert nanoseconds to milliseconds

    // 2. Poll (Sub /poll hot path)
    const t2 = process.hrtime.bigint();
    const claimed = service.claimPendingCommands('DEMO-SUB-1', 1);
    const t3 = process.hrtime.bigint();
    pollTimes.push(Number(t3 - t2) / 1e6);

    // 3. ACK (Sub /ack hot path)
    const t4 = process.hrtime.bigint();
    service.acknowledgeCommand('DEMO-SUB-1', claimed[0].id);
    const t5 = process.hrtime.bigint();
    ackTimes.push(Number(t5 - t4) / 1e6);

    // 4. Result (Sub /result hot path)
    const t6 = process.hrtime.bigint();
    service.recordExecutionResult('DEMO-SUB-1', {
      commandId: claimed[0].id,
      success: true,
      retcode: 10009,
      orderTicket: BigInt(90000000 + i),
      dealTicket: BigInt(80000000 + i),
      executedVolume: 0.1,
      executedPrice: 64510.5,
    });
    const t7 = process.hrtime.bigint();
    resultTimes.push(Number(t7 - t6) / 1e6);
  }

  service.onModuleDestroy();

  const enqStats = calculatePercentiles(enqueueTimes);
  const pollStats = calculatePercentiles(pollTimes);
  const ackStats = calculatePercentiles(ackTimes);
  const resStats = calculatePercentiles(resultTimes);

  console.log('HOT PATH BENCHMARK RESULTS (1,000 Iterations):');
  console.log('-----------------------------------------------------------------------------------------');
  console.log('| Operation                  | Average (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) |');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(`| Enqueue (/open Hot Path)   | ${enqStats.mean.toFixed(3).padStart(12)} | ${enqStats.p50.toFixed(3).padStart(8)} | ${enqStats.p95.toFixed(3).padStart(8)} | ${enqStats.p99.toFixed(3).padStart(8)} | ${enqStats.max.toFixed(3).padStart(8)} |`);
  console.log(`| Atomic Claim (/poll)       | ${pollStats.mean.toFixed(3).padStart(12)} | ${pollStats.p50.toFixed(3).padStart(8)} | ${pollStats.p95.toFixed(3).padStart(8)} | ${pollStats.p99.toFixed(3).padStart(8)} | ${pollStats.max.toFixed(3).padStart(8)} |`);
  console.log(`| Acknowledge (/ack)         | ${ackStats.mean.toFixed(3).padStart(12)} | ${ackStats.p50.toFixed(3).padStart(8)} | ${ackStats.p95.toFixed(3).padStart(8)} | ${ackStats.p99.toFixed(3).padStart(8)} | ${ackStats.max.toFixed(3).padStart(8)} |`);
  console.log(`| Execution Result (/result) | ${resStats.mean.toFixed(3).padStart(12)} | ${resStats.p50.toFixed(3).padStart(8)} | ${resStats.p95.toFixed(3).padStart(8)} | ${resStats.p99.toFixed(3).padStart(8)} | ${resStats.max.toFixed(3).padStart(8)} |`);
  console.log('-----------------------------------------------------------------------------------------\n');

  console.log('COMPARISON: REMOTE SUPABASE VS IN-MEMORY HOT PATH:');
  console.log('-----------------------------------------------------------------------------------------');
  console.log('| Stage                      | Remote Supabase (Baseline) | Hot Path (Measured) | Speedup|');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(`| Master /open Processing    | ~2,006.000 ms             | ${enqStats.mean.toFixed(3).padStart(15)} ms  | ${(2006 / enqStats.mean).toFixed(0)}x faster |`);
  console.log(`| Sub /poll Command Claim    | ~2,686.000 ms             | ${pollStats.mean.toFixed(3).padStart(15)} ms  | ${(2686 / pollStats.mean).toFixed(0)}x faster |`);
  console.log(`| Sub /ack Processing        |   ~650.000 ms             | ${ackStats.mean.toFixed(3).padStart(15)} ms  | ${(650 / ackStats.mean).toFixed(0)}x faster |`);
  console.log(`| Sub /result Processing     |   ~800.000 ms             | ${resStats.mean.toFixed(3).padStart(15)} ms  | ${(800 / resStats.mean).toFixed(0)}x faster |`);
  console.log('-----------------------------------------------------------------------------------------\n');
}

runHotPathBenchmark().catch(console.error);
