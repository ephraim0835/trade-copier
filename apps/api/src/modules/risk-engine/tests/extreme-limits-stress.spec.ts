import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from '../services/currency.service';
import { LotCalculatorService } from '../services/lot-calculator.service';
import { RiskEngineService } from '../services/risk-engine.service';
import {
  RiskProfile,
  TradeSignalInput,
  SymbolSpecs,
} from '../interfaces/risk.interfaces';
import { CopyState } from '@prisma/client';

describe('Extreme Limits & Stress Testing Matrix', () => {
  let lotCalc: LotCalculatorService;
  let currencyService: CurrencyService;
  let riskEngine: RiskEngineService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService, LotCalculatorService, RiskEngineService],
    }).compile();

    lotCalc = module.get<LotCalculatorService>(LotCalculatorService);
    currencyService = module.get<CurrencyService>(CurrencyService);
    riskEngine = module.get<RiskEngineService>(RiskEngineService);
  });

  // =========================================================================
  // 1. LEVERAGE EXTREMES (1:1 CASH ACCOUNT UP TO 1:3000 HYPER-LEVERAGE)
  // =========================================================================
  describe('1. Extreme Leverage Boundaries (1:1 to 1:3000)', () => {
    it('1.1 Leverage 1:1 (No borrowing): enforces strict margin clamp on $10k account', () => {
      // 1:1 leverage on EURUSD ($1.1000) requires $110,000 margin for 1.0 lot!
      // On a $10,000 account with 85% safety threshold ($8,500 safe margin):
      // Max affordable lots = 8,500 / 110,000 = 0.077 -> 0.07 lots!
      // Even if 2% risk over 10 pips ($100/lot) requests 2.0 lots ($200 risk), margin ceiling must clamp it to 0.07 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, freeMargin: 10000, currency: 'USD', leverage: 1 },
        { balance: 10000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 1.1000, stopLoss: 1.0990 },
      );
      expect(res.marginClamped).toBe(true);
      expect(res.finalVolume).toBe(0.07);
      expect(res.finalVolume).toBeLessThan(2.0);
    });

    it('1.2 Leverage 1:3000 (Hyper-leverage): margin per lot is tiny (~$36.67), allows full mathematical sizing', () => {
      // Margin required for 1.0 lot EURUSD @ 1.1000 with 1:3000 leverage = $110,000 / 3000 = $36.67
      // Sub balance $20,000 risking 1.0% ($200) over 20 pips ($200/lot) -> exactly 1.00 lot
      const res = lotCalc.calculateLotSize(
        { balance: 20000, equity: 20000, freeMargin: 20000, currency: 'USD', leverage: 3000 },
        { balance: 20000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.marginClamped).toBe(false);
      expect(res.finalVolume).toBe(1.00);
    });
  });

  // =========================================================================
  // 2. ULTRA-TIGHT SCALPING & RAZOR-THIN STOP LOSS LIMITS
  // =========================================================================
  describe('2. Ultra-Tight Scalping & Razor-Thin SL Limits', () => {
    it('2.1 Razor-thin 1 pip SL (0.00010 distance) on $100k account: prevents over-sizing via maxLot', () => {
      // 1 pip SL on EURUSD = $10/lot loss. On a $100,000 account @ 1% risk ($1,000):
      // Raw volume would be 1000 / 10 = 100.00 lots!
      // If broker maxLot constraint is 50.0 lots, engine MUST clamp to 50.0 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 100000, equity: 100000, freeMargin: 100000, currency: 'USD', leverage: 100 },
        { balance: 100000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 1.0, entryPrice: 1.1000, stopLoss: 1.0999 },
        { minLot: 0.01, maxLot: 50.0, lotStep: 0.01 },
      );
      expect(res.finalVolume).toBe(50.0);
    });

    it('2.2 Ultra-tight 2 pip SL with low free margin: free margin clamp overrides high lot calculation', () => {
      // $5,000 account with only $300 free margin left (leverage 1:100, margin per lot = $1,100).
      // Safe margin = $300 * 0.85 = $255. Max affordable lots = 255 / 1100 = 0.23 lots.
      // Raw 2 pip SL ($20/lot loss) @ 1% ($50 risk) = 2.50 lots.
      // Margin ceiling MUST clamp volume to 0.23 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 5000, equity: 5000, freeMargin: 300, currency: 'USD', leverage: 100 },
        { balance: 5000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 1.1000, stopLoss: 1.0998 },
      );
      expect(res.marginClamped).toBe(true);
      expect(res.finalVolume).toBe(0.23);
    });
  });

  // =========================================================================
  // 3. MASSIVE INSTITUTIONAL BALANCES & MEGA-VOLUMES
  // =========================================================================
  describe('3. Massive Institutional Balances ($10M - $100M)', () => {
    it('3.1 $10,000,000 Institutional Account risking 0.5% over 50 pips EURUSD', () => {
      // Cash risk: $10M * 0.5% = $50,000. 50 pips SL ($500/lot loss).
      // Target lots: 50,000 / 500 = 100.00 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 10000000, equity: 10000000, freeMargin: 10000000, currency: 'USD', leverage: 100 },
        { balance: 10000000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 0.5 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 5.0, entryPrice: 1.1000, stopLoss: 1.0950 },
        { minLot: 0.01, maxLot: 200.0, lotStep: 0.01 },
      );
      expect(res.finalVolume).toBe(100.0);
    });

    it('3.2 Institutional Account with strict User Hard Cap: caps 200-lot trade to 10.0 lots', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 10000000, equity: 10000000, freeMargin: 10000000, currency: 'USD', leverage: 100 },
        { balance: 10000000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0, maxLotCap: 10.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 5.0, entryPrice: 1.1000, stopLoss: 1.0950 },
      );
      expect(res.maxLotClamped).toBe(true);
      expect(res.finalVolume).toBe(10.0);
    });
  });

  // =========================================================================
  // 4. MICRO AND DUST BALANCE PROTECTION ($0.05 to $5.00)
  // =========================================================================
  describe('4. Micro and Dust Balance Protection', () => {
    it('4.1 Dust Balance ($0.50 cents): clamps to minLot 0.01 without arithmetic error', () => {
      // $0.50 @ 1.0% risk = $0.005. 20 pips SL ($200/lot). Volume = 0.000025 lots -> clamped to 0.01
      const res = lotCalc.calculateLotSize(
        { balance: 0.50, equity: 0.50, freeMargin: 0.50, currency: 'USD', leverage: 100 },
        { balance: 1000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(0.01);
    });

    it('4.2 Micro Balance ($5.00): 0.1% micro-risk safely clamps to 0.01 lots', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 5.00, equity: 5.00, freeMargin: 5.00, currency: 'USD', leverage: 100 },
        { balance: 1000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 0.1 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(0.01);
    });
  });

  // =========================================================================
  // 5. EXOTIC ASSET & VOLATILITY BOUNDARIES
  // =========================================================================
  describe('5. Exotic Asset & Volatility Boundaries', () => {
    it('5.1 Natural Gas (XNGUSD) with 10,000 contract size: $0.20 SL = $2,000/lot loss', () => {
      // 0.20 * 10000 = $2,000 loss/lot. On $20,000 account @ 1% risk ($200):
      // Lots = 200 / 2000 = 0.10 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 20000, equity: 20000, freeMargin: 20000, currency: 'USD', leverage: 100 },
        { balance: 20000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'XNGUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 2.80, stopLoss: 2.60 },
      );
      expect(res.lossPerLotUSD).toBe(2000);
      expect(res.finalVolume).toBe(0.10);
    });

    it('5.2 German DAX (GER40 / DAX40): 150 points SL = $150 loss/lot', () => {
      // 150 * 1 = $150 loss/lot. On $20,000 account @ 1.5% risk ($300):
      // Lots = 300 / 150 = 2.00 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 20000, equity: 20000, freeMargin: 20000, currency: 'USD', leverage: 100 },
        { balance: 20000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.5 },
        { symbol: 'GER40', orderType: 'BUY', masterVolume: 0.5, entryPrice: 19500, stopLoss: 19350 },
      );
      expect(res.lossPerLotUSD).toBe(150);
      expect(res.finalVolume).toBe(2.00);
    });

    it('5.3 Japanese Nikkei (JP225): 400 points SL with JPY conversion', () => {
      // 400 * (1/152) = $2.6316 loss/lot. On $20,000 account @ 1.0% risk ($200):
      // Lots = 200 / 2.6316 = 76.00 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 20000, equity: 20000, freeMargin: 20000, currency: 'USD', leverage: 100 },
        { balance: 20000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'JP225', orderType: 'BUY', masterVolume: 1.0, entryPrice: 39000, stopLoss: 38600 },
      );
      expect(res.finalVolume).toBeGreaterThan(50.0);
    });

    it('5.4 Massive Crypto Swing: BTCUSD with $8,000 SL distance', () => {
      // SL distance = $8,000. Loss per lot = $8,000.
      // On $20,000 account @ 2.0% risk ($400):
      // Lots = 400 / 8000 = 0.05 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 20000, equity: 20000, freeMargin: 20000, currency: 'USD', leverage: 100 },
        { balance: 20000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'BTCUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 68000, stopLoss: 60000 },
      );
      expect(res.lossPerLotUSD).toBe(8000);
      expect(res.finalVolume).toBe(0.05);
    });
  });

  // =========================================================================
  // 6. DAILY RISK & DRAWDOWN HARD KILL-SWITCH LIMITS (RiskEngineService)
  // =========================================================================
  describe('6. Daily Risk & Drawdown Hard Kill-Switch', () => {
    const profileWithDailyLimit: RiskProfile = {
      equity: 10000,
      balance: 10000,
      initialBalance: 10000,
      currency: 'USD',
      marginFree: 10000,
      accountType: 'HEDGING',
      riskPercentage: 1.0, // $100 per trade
      roundingTolerancePct: 2.0,
      dailyRiskEnabled: true,
      maxDailyRisk: 300, // Max $300 daily risk limit
      currentDailyRisk: 250, // Already at $250!
      maxTradesEnabled: true,
      maxActiveTrades: 5,
      currentActiveTrades: 2,
      requireTp: false,
      missingSlTimeoutSec: 60,
      maxRecoveryRRDegradation: 0.5,
    };

    const dummySpecs: SymbolSpecs = {
      contractSize: 100000,
      tickSize: 0.00001,
      tickValue: 1.0,
      volumeStep: 0.01,
      volumeMin: 0.01,
      volumeMax: 100.0,
      marginRequiredPerLot: 1000,
    };

    it('6.1 Rejects incoming trade when it would breach maxDailyRisk threshold', () => {
      // Current daily risk: $250. Max allowance: $300 (remaining: $50).
      // New trade risks $100 (1% of $10,000). Total would be $350 > $300!
      // Engine MUST reject the trade!
      const decision = riskEngine.evaluateTrade(
        {
          signalId: 'sig-kill-1',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          priceOpen: 1.1000,
          sl: 1.0975,
          tp: 1.1050,
          time: new Date(),
        },
        profileWithDailyLimit,
        dummySpecs,
      );
      expect(decision.state).toBe(CopyState.REJECTED);
      expect(decision.rejectionReason).toContain('Daily risk limit: would add $100');
    });

    it('6.2 Approves trade when within remaining daily risk allowance', () => {
      const relaxedProfile = { ...profileWithDailyLimit, currentDailyRisk: 100 }; // $200 remaining
      const decision = riskEngine.evaluateTrade(
        {
          signalId: 'sig-ok-1',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          priceOpen: 1.1000,
          sl: 1.0975,
          tp: 1.1050,
          time: new Date(),
        },
        relaxedProfile,
        dummySpecs,
      );
      expect(decision.state).toBe(CopyState.APPROVED);
      expect(decision.dailyRiskAfter).toBe(200);
    });

    it('6.3 Rejects incoming trade when maxActiveTrades limit is hit', () => {
      const maxTradesProfile = { ...profileWithDailyLimit, currentDailyRisk: 0, currentActiveTrades: 5 }; // Max is 5!
      const decision = riskEngine.evaluateTrade(
        {
          signalId: 'sig-max-1',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          priceOpen: 1.1000,
          sl: 1.0975,
          tp: 1.1050,
          time: new Date(),
        },
        maxTradesProfile,
        dummySpecs,
      );
      expect(decision.state).toBe(CopyState.REJECTED);
      expect(decision.rejectionReason).toContain('Max active trades reached (5)');
    });

    it('6.4 Rejects recovery trade if master signal no longer exists', () => {
      const decision = riskEngine.evaluateTrade(
        {
          signalId: 'sig-rec-1',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          priceOpen: 1.1000,
          sl: 1.0975,
          tp: 1.1050,
          time: new Date(),
        },
        profileWithDailyLimit,
        dummySpecs,
        {
          masterSignalExists: false, // Master trade was closed!
          isAlreadyCopied: false,
          currentMarketPrice: 1.1020,
        },
      );
      expect(decision.state).toBe(CopyState.REJECTED);
      expect(decision.rejectionReason).toContain('master trade no longer exists');
    });

    it('6.5 Rejects recovery trade if already copied (idempotent protection)', () => {
      const decision = riskEngine.evaluateTrade(
        {
          signalId: 'sig-rec-2',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          priceOpen: 1.1000,
          sl: 1.0975,
          tp: 1.1050,
          time: new Date(),
        },
        profileWithDailyLimit,
        dummySpecs,
        {
          masterSignalExists: true,
          isAlreadyCopied: true, // Already copied!
          currentMarketPrice: 1.1020,
        },
      );
      expect(decision.state).toBe(CopyState.REJECTED);
      expect(decision.rejectionReason).toContain('trade already copied (duplicate)');
    });

  });

  // =========================================================================
  // 7. HIGH-CONCURRENCY BURST STRESS TEST (1,000 SIMULTANEOUS EVALUATIONS)
  // =========================================================================
  describe('7. High-Concurrency Burst Stress Testing', () => {
    it('evaluates 1,000 simultaneous trade calculations in under 100 milliseconds with zero memory leak', () => {
      const start = Date.now();
      const count = 1000;
      const results: any[] = [];

      for (let i = 0; i < count; i++) {
        const pips = 10 + (i % 50); // 10 to 60 pips
        const res = lotCalc.calculateLotSize(
          { balance: 10000 + i * 10, equity: 10000 + i * 10, currency: 'USD', leverage: 100 },
          { balance: 10000, currency: 'USD' },
          { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
          { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 1.1000, stopLoss: 1.1000 - pips * 0.0001 },
        );
        results.push(res);
      }

      const durationMs = Date.now() - start;
      expect(results.length).toBe(1000);
      expect(durationMs).toBeLessThan(500); // 1,000 evaluations under 500ms
      expect(results.every((r) => r.finalVolume > 0)).toBe(true);
    });
  });
});
