import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

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

function makeHttpRequest(port: number, method: string, pathUrl: string, token: string, body?: any): Promise<{ status: number; data: any; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Connection': 'close',
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathUrl,
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          const t1 = process.hrtime.bigint();
          const durationMs = Number(t1 - t0) / 1e6;
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode || 200, data: parsed, durationMs });
          } catch (e) {
            resolve({ status: res.statusCode || 200, data: rawData, durationMs });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

async function runHttpHotPathBenchmark() {
  console.log('===================================================================');
  console.log('=== REAL HTTP LOOPBACK HOT-PATH PERFORMANCE BENCHMARK ===');
  console.log('===================================================================\n');

  // Start NestJS App on port 9099
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const PORT = 9099;
  await app.listen(PORT);

  const MASTER_TOKEN = 'master-token-id.mastersecret';
  const SUB_TOKEN = 'sub-token-id.subsecret';

  // Seed token cache for benchmark accounts
  const eaAuthService = app.get(require('../src/modules/ea-auth/ea-auth.service').EaAuthService);
  const tokenCache = (eaAuthService as any).tokenCache;
  const now = Date.now();
  tokenCache.set(MASTER_TOKEN, {
    account: { id: 'master-demo-1', role: 'MASTER', isDemo: true, isActive: true },
    expiresAt: now + 3600000,
    lastUpdated: now,
  });
  tokenCache.set(SUB_TOKEN, {
    account: { id: 'sub-demo-1', role: 'SUB', isDemo: true, isActive: true },
    expiresAt: now + 3600000,
    lastUpdated: now,
  });

  // Seed sub accounts cache in MasterSignalService
  const masterSignalService = app.get(require('../src/modules/execution/services/master-signal.service').MasterSignalService);
  (masterSignalService as any).subAccountsCache = [
    {
      id: 'sub-demo-1',
      isDemo: true,
      isActive: true,
      copySettings: {
        riskMultiplier: 1.0,
        roundingTolerancePct: 5,
        dailyRiskEnabled: false,
        maxDailyRisk: 500,
        maxTradesEnabled: false,
        maxActiveTrades: 10,
        requireTp: false,
        missingSlTimeoutSec: 60,
        maxRecoveryRRDegradation: 0.5,
      },
    },
  ];

  console.log(`NestJS API started on http://127.0.0.1:${PORT}\n`);

  // Warmup 50 requests
  console.log('Warming up HTTP hot path (50 requests)...');
  for (let i = 1; i <= 50; i++) {
    await makeHttpRequest(PORT, 'GET', '/execution/poll', SUB_TOKEN);
  }

  const ITERATIONS = 500;
  console.log(`Running ${ITERATIONS} full end-to-end HTTP lifecycle iterations...\n`);

  const openTimes: number[] = [];
  const pollTimes: number[] = [];
  const ackTimes: number[] = [];
  const resultTimes: number[] = [];

  for (let i = 1; i <= ITERATIONS; i++) {
    const ticket = (70000000 + i).toString();

    // 1. POST /master/signal/open
    const openRes = await makeHttpRequest(PORT, 'POST', '/master/signal/open', MASTER_TOKEN, {
      ticket,
      symbol: 'BTCUSDm',
      type: 'BUY',
      volume: 0.1,
      priceOpen: 64500,
      sl: 64000,
      tp: 65500,
      sequenceNumber: 1,
      masterEventDetectedAt: Date.now() * 1000,
      masterEventQueuedAt: Date.now() * 1000,
      masterEventSentAt: Date.now() * 1000,
    });
    openTimes.push(openRes.durationMs);

    // 2. GET /execution/poll
    const pollRes = await makeHttpRequest(PORT, 'GET', '/execution/poll', SUB_TOKEN);
    pollTimes.push(pollRes.durationMs);

    const command = pollRes.data?.commands?.[0];
    if (command) {
      // 3. POST /execution/ack
      const ackRes = await makeHttpRequest(PORT, 'POST', '/execution/ack', SUB_TOKEN, {
        commandId: command.commandId,
        subReceivedAt: Date.now() * 1000,
        subAcknowledgedAt: Date.now() * 1000,
      });
      ackTimes.push(ackRes.durationMs);

      // 4. POST /execution/result
      const resultRes = await makeHttpRequest(PORT, 'POST', '/execution/result', SUB_TOKEN, {
        commandId: command.commandId,
        success: true,
        retcode: 10009,
        orderTicket: (80000000 + i).toString(),
        dealTicket: (90000000 + i).toString(),
        executedVolume: 0.1,
        executedPrice: 64505.5,
        subReceivedAt: (Date.now() - 20) * 1000,
        subAcknowledgedAt: (Date.now() - 15) * 1000,
        subExecutionStartedAt: (Date.now() - 10) * 1000,
        subExecutionCompletedAt: Date.now() * 1000,
        timestamp: new Date().toISOString(),
      });
      resultTimes.push(resultRes.durationMs);
    }
  }

  await app.close();

  const openStats = calculatePercentiles(openTimes);
  const pollStats = calculatePercentiles(pollTimes);
  const ackStats = calculatePercentiles(ackTimes);
  const resStats = calculatePercentiles(resultTimes);

  console.log('REAL HTTP LOOPBACK HOT-PATH RESULTS (500 Iterations):');
  console.log('----------------------------------------------------------------------------------------------------');
  console.log('| Endpoint                   | Average (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Min (ms) | Max (ms) |');
  console.log('----------------------------------------------------------------------------------------------------');
  console.log(`| POST /master/signal/open   | ${openStats.mean.toFixed(2).padStart(12)} | ${openStats.p50.toFixed(2).padStart(8)} | ${openStats.p95.toFixed(2).padStart(8)} | ${openStats.p99.toFixed(2).padStart(8)} | ${openStats.min.toFixed(2).padStart(8)} | ${openStats.max.toFixed(2).padStart(8)} |`);
  console.log(`| GET /execution/poll        | ${pollStats.mean.toFixed(2).padStart(12)} | ${pollStats.p50.toFixed(2).padStart(8)} | ${pollStats.p95.toFixed(2).padStart(8)} | ${pollStats.p99.toFixed(2).padStart(8)} | ${pollStats.min.toFixed(2).padStart(8)} | ${pollStats.max.toFixed(2).padStart(8)} |`);
  console.log(`| POST /execution/ack        | ${ackStats.mean.toFixed(2).padStart(12)} | ${ackStats.p50.toFixed(2).padStart(8)} | ${ackStats.p95.toFixed(2).padStart(8)} | ${ackStats.p99.toFixed(2).padStart(8)} | ${ackStats.min.toFixed(2).padStart(8)} | ${ackStats.max.toFixed(2).padStart(8)} |`);
  console.log(`| POST /execution/result     | ${resStats.mean.toFixed(2).padStart(12)} | ${resStats.p50.toFixed(2).padStart(8)} | ${resStats.p95.toFixed(2).padStart(8)} | ${resStats.p99.toFixed(2).padStart(8)} | ${resStats.min.toFixed(2).padStart(8)} | ${resStats.max.toFixed(2).padStart(8)} |`);
  console.log('----------------------------------------------------------------------------------------------------\n');

  console.log('COMPARISON: PREVIOUS SYNCHRONOUS DB BASELINE VS NEW HTTP HOT PATH:');
  console.log('----------------------------------------------------------------------------------------------------');
  console.log('| Request                    | Previous Synchronous DB | New HTTP Hot Path (Measured) | Speedup     |');
  console.log('----------------------------------------------------------------------------------------------------');
  console.log(`| POST /master/signal/open   | ~2,006.00 ms            | ${openStats.mean.toFixed(2).padStart(20)} ms        | ${(2006 / openStats.mean).toFixed(0)}x faster |`);
  console.log(`| GET /execution/poll        | ~2,686.00 ms            | ${pollStats.mean.toFixed(2).padStart(20)} ms        | ${(2686 / pollStats.mean).toFixed(0)}x faster |`);
  console.log(`| POST /execution/ack        |   ~650.00 ms            | ${ackStats.mean.toFixed(2).padStart(20)} ms        | ${(650 / ackStats.mean).toFixed(0)}x faster  |`);
  console.log(`| POST /execution/result     |   ~800.00 ms            | ${resStats.mean.toFixed(2).padStart(20)} ms        | ${(800 / resStats.mean).toFixed(0)}x faster  |`);
  console.log('----------------------------------------------------------------------------------------------------\n');
}

runHttpHotPathBenchmark().catch(console.error);
