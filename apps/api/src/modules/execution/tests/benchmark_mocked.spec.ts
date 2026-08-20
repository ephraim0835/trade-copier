import { ExecutionService } from '../services/execution.service';
import { MasterSignalService } from '../services/master-signal.service';
import { HotDispatchService } from '../services/hot-dispatch.service';
import { AsyncPersistenceService } from '../services/async-persistence.service';
import { performance } from 'perf_hooks';
import { CopyState, OrderType } from '@prisma/client';

async function runBenchmark() {
  const hotDispatch = new HotDispatchService();
  hotDispatch.disableJournaling = true;
  const asyncPersistence = { enqueueTask: jest.fn() } as any;

  const mockRiskEngine = {
    evaluateTrade: jest.fn().mockReturnValue({ state: CopyState.APPROVED, executedVol: 0.1 }),
  };

  const mockPrisma = {
    mt5Account: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sub-1', isDemo: true, isActive: true, copySettings: { riskMultiplier: 1 } },
      ]),
    },
    tradeSignal: { upsert: jest.fn(), update: jest.fn() },
    tradeCopy: { createMany: jest.fn(), update: jest.fn() },
    executionCommand: { createMany: jest.fn() },
    $transaction: jest.fn(async (cb) => cb({})),
  };

  const execService = new ExecutionService(hotDispatch, asyncPersistence);
  const masterSignalService = new MasterSignalService(mockPrisma as any, mockRiskEngine as any, hotDispatch, asyncPersistence);
  await masterSignalService.onModuleInit();

  const latencies: Record<number, number[]> = { 100: [], 50: [], 25: [] };
  const intervals = [100, 50, 25];

  for (const intervalMs of intervals) {
    let isPolling = true;

    // Simulate Sub EA Polling
    const pollInterval = setInterval(async () => {
      if (!isPolling) return;
      const start = performance.now();
      await execService.getPendingCommands('sub-1');
      const end = performance.now();
      latencies[intervalMs].push(end - start);
    }, intervalMs);

    // Simulate Master EA Burst
    await new Promise(r => setTimeout(r, 50));
    const NUM_REQUESTS = 20;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      const ticket = (intervalMs * 5000 + i).toString();
      await masterSignalService.processOpen(
        'master-1',
        {
          ticket,
          symbol: 'EURUSD',
          type: OrderType.BUY,
          volume: 0.1,
          priceOpen: 1.1,
          sl: 1.05,
          sequenceNumber: i + 1,
        },
        Date.now()
      );
    }

    await new Promise(r => setTimeout(r, 200));
    isPolling = false;
    clearInterval(pollInterval);
  }

  masterSignalService.onModuleDestroy();
  hotDispatch.onModuleDestroy();

  return latencies;
}

describe('Mock Benchmark', () => {
  it('runs the benchmark', async () => {
    const latencies = await runBenchmark();
    expect(latencies[100].length).toBeGreaterThan(0);
    expect(latencies[50].length).toBeGreaterThan(0);
    expect(latencies[25].length).toBeGreaterThan(0);
  });
});
