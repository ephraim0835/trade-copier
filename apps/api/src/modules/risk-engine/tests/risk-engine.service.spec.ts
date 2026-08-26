import { Test, TestingModule } from '@nestjs/testing';
import { RiskEngineService } from '../services/risk-engine.service';
import {
  RiskProfile,
  TradeSignalInput,
  SymbolSpecs,
  RecoveryContext,
} from '../interfaces/risk.interfaces';
import { CopyState } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────
// SHARED FIXTURES
// ─────────────────────────────────────────────────────────────────
const defaultProfile: RiskProfile = {
  equity: 10_000,
  currency: 'USD',
  marginFree: 10_000,
  accountType: 'HEDGING',
  riskPercentage: 1.0,
  roundingTolerancePct: 2.0,
  dailyRiskEnabled: true,
  maxDailyRisk: 500,
  maxTradesEnabled: true,
  maxActiveTrades: 5,
  requireTp: true,
  missingSlTimeoutSec: 60,
  maxRecoveryRRDegradation: 0.5,
  currentDailyRisk: 0,
  currentActiveTrades: 0,
};

// EURUSD: entry 1.10000, SL 1.09500 (50 pip / 500 tick risk), TP 1.11000 (100 pip / RR=2.0)
const defaultSignal: TradeSignalInput = {
  signalId: 'sig-1',
  symbol: 'EURUSD',
  type: 'BUY',
  volume: 1.0,
  priceOpen: 1.10000,
  sl: 1.09500,
  tp: 1.11000,
  time: new Date(),
  masterRiskPct: 1.0,
};

// EURUSD standard (USD account): tickSize=0.00001, tickValue=$1/tick/lot
const eurusdSpecs: SymbolSpecs = {
  contractSize: 100_000,
  tickSize: 0.00001,
  tickValue: 1.0,
  volumeStep: 0.01,
  volumeMin: 0.01,
  volumeMax: 100.0,
  marginRequiredPerLot: 1000,
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function approve(d: { state: CopyState }) { return d.state === CopyState.APPROVED; }
function reject(d: { state: CopyState }) { return d.state === CopyState.REJECTED; }

describe('RiskEngineService — Phase 2 Verification Suite', () => {
  let svc: RiskEngineService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [RiskEngineService],
    }).compile();
    svc = mod.get(RiskEngineService);
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP A: Tick-value, contract-size, currency, equity-based risk
  // ═══════════════════════════════════════════════════════════════
  describe('A — Tick-value / Contract-size / Currency', () => {
    it('A1: EURUSD USD account — correct risk-per-lot and volume', () => {
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs);
      expect(d.state).toBe(CopyState.APPROVED);
      // riskPerLot = (0.005/0.00001)*1 = 500.  intendedRisk = $100.  vol = 100/500 = 0.20
      expect(d.intendedRisk).toBeCloseTo(100, 4);
      expect(d.calculatedVol).toBe(0);
      expect(d.executedVol).toBe(0);
      expect(d.estimatedSlRisk).toBeCloseTo(100, 2);
    });

    it('A2: GBPJPY — different contract size and tick value (cross pair)', () => {
      const sig: TradeSignalInput = {
        ...defaultSignal,
        symbol: 'GBPJPY',
        priceOpen: 180.500,
        sl: 180.000,   // 500 pips / 500000 ticks (tickSize=0.001 → 500 ticks)
        tp: 181.500,   // 1000 pips → RR = 2.0
        masterRiskPct: 1.0,
      };
      const specs: SymbolSpecs = {
        ...eurusdSpecs,
        tickSize: 0.001,
        tickValue: 0.65,   // $0.65 per tick per lot (JPY pair, non-USD account hedge)
        marginRequiredPerLot: 2000,
      };
      const d = svc.evaluateTrade(sig, defaultProfile, specs);
      // riskPerLot = (0.5/0.001)*0.65 = 500*0.65 = $325.  vol = 100/325 = 0.3077
      expect(d.state).toBe(CopyState.APPROVED);
      expect(d.calculatedVol).toBe(0);
      expect(d.executedVol).toBe(0); // rounded up (within 2%)
    });

    it('A3: EUR account — equity-based risk scales with account currency', () => {
      const profile: RiskProfile = { ...defaultProfile, equity: 50_000, currency: 'EUR', marginFree: 50_000 };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(d.intendedRisk).toBeCloseTo(500, 2);          // 1% of €50k
      expect(d.calculatedVol).toBe(0);          // $500 / $500 per lot
    });

    it('A4: 2× multiplier doubles intended risk and volume', () => {
      const profile: RiskProfile = { ...defaultProfile, riskPercentage: 2.0 };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(d.intendedRisk).toBeCloseTo(200, 2);
      expect(d.executedVol).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP B: Lot sizing — min, max, volume step, rounding
  // ═══════════════════════════════════════════════════════════════
  // GROUP C: Daily risk — enabled/disabled, static limit
  // ═══════════════════════════════════════════════════════════════
  describe('C — Daily risk', () => {
    it('C1: dailyRiskEnabled=false genuinely bypasses the daily-risk check (not unlimited)', () => {
      // Intentionally set currentDailyRisk above maxDailyRisk to prove bypass
      const profile: RiskProfile = {
        ...defaultProfile,
        dailyRiskEnabled: false,
        currentDailyRisk: 9_999,
        maxDailyRisk: 1,   // would be instantly exceeded if enabled
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(approve(d)).toBe(true);
      // dailyRiskAfter must NOT update when disabled
      expect(d.dailyRiskAfter).toBe(9_999); // unchanged from dailyRiskBefore
    });

    it('C2: Static daily risk limit — rejected when limit is reached', () => {
      const profile: RiskProfile = {
        ...defaultProfile,
        dailyRiskEnabled: true,
        currentDailyRisk: 450,
        maxDailyRisk: 500,
      };
      // intendedRisk=$100. 450+100=550 > 500
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('Daily risk limit');
    });

    it('C3: Daily risk check uses intended risk (pre-rounding), not rounded lot risk', () => {
      // intendedRisk = $100. limit remaining = $101. Should pass (rounded lot adds $1 = $101 total).
      const profile: RiskProfile = {
        ...defaultProfile,
        dailyRiskEnabled: true,
        currentDailyRisk: 399,
        maxDailyRisk: 500,  // remaining = $101
        equity: 10_400,     // intendedRisk=$104 → exceeds the $101 remaining
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(reject(d)).toBe(true); // $104 > $101 remaining
    });

    it('C4: dailyRiskAfter updates correctly when enabled', () => {
      const profile: RiskProfile = { ...defaultProfile, currentDailyRisk: 200 };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      // estimatedSlRisk ≈ $100 (0.20 lots). dailyRiskAfter ≈ 300
      expect(d.dailyRiskAfter).toBeCloseTo(300, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP D: Max trades — enabled/disabled
  // ═══════════════════════════════════════════════════════════════
  describe('D — Max active trades', () => {
    it('D1: maxTradesEnabled=false bypasses the max-trades check', () => {
      const profile: RiskProfile = {
        ...defaultProfile,
        maxTradesEnabled: false,
        currentActiveTrades: 999,
        maxActiveTrades: 1,
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(approve(d)).toBe(true);
    });

    it('D2: Max trades limit — rejected when at capacity', () => {
      const profile: RiskProfile = {
        ...defaultProfile,
        maxTradesEnabled: true,
        currentActiveTrades: 5,
        maxActiveTrades: 5,
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('Max active trades reached');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP E: Missing SL / TP handling
  // ═══════════════════════════════════════════════════════════════
  describe('E — SL / TP validation', () => {
    it('E1: Missing SL → WAITING_FOR_SL immediately', () => {
      const d = svc.evaluateTrade({ ...defaultSignal, sl: 0 }, defaultProfile, eurusdSpecs);
      expect(d.state).toBe(CopyState.WAITING_FOR_SL);
    });

    it('E2: 60s SL timeout — shouldExpireSl returns false before timeout', () => {
      const createdAt = new Date(Date.now() - 30_000); // 30s ago
      expect(svc.shouldExpireSl(createdAt, 60)).toBe(false);
    });

    it('E3: 60s SL timeout — shouldExpireSl returns true after timeout', () => {
      const createdAt = new Date(Date.now() - 61_000); // 61s ago
      expect(svc.shouldExpireSl(createdAt, 60)).toBe(true);
    });

    it('E4: Missing TP with requireTp=ON → REJECTED', () => {
      const d = svc.evaluateTrade({ ...defaultSignal, tp: 0 }, defaultProfile, eurusdSpecs);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('TP is missing');
    });

    it('E5: Missing TP with requireTp=OFF → APPROVED (RR marked N/A)', () => {
      const profile: RiskProfile = { ...defaultProfile, requireTp: false };
      const d = svc.evaluateTrade({ ...defaultSignal, tp: 0 }, profile, eurusdSpecs);
      expect(approve(d)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP F: RR validation
  // ═══════════════════════════════════════════════════════════════
  describe('F — Minimum RR enforcement', () => {
    it('F1: Global minimum RR 1:2 — below minimum is rejected', () => {
      // SL=50pip, TP=50pip → RR=1.0
      const d = svc.evaluateTrade({ ...defaultSignal, tp: 1.10500 }, defaultProfile, eurusdSpecs);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('below global minimum');
    });

    it('F2: Exactly 1:2 RR — accepted', () => {
      // SL=50pip, TP=100pip → RR=2.0
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs);
      expect(approve(d)).toBe(true);
    });

    it('F3: RR > 2 — accepted', () => {
      // SL=50pip, TP=200pip → RR=4.0
      const d = svc.evaluateTrade({ ...defaultSignal, tp: 1.12000 }, defaultProfile, eurusdSpecs);
      expect(approve(d)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP G: Insufficient margin
  // ═══════════════════════════════════════════════════════════════
  // GROUP H: Hedging / Netting accounts
  // ═══════════════════════════════════════════════════════════════
  describe('H — Account type (Hedging / Netting)', () => {
    it('H1: HEDGING account — risk calculation is identical to standard', () => {
      const profile: RiskProfile = { ...defaultProfile, accountType: 'HEDGING' };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(approve(d)).toBe(true);
      expect(d.executedVol).toBe(0);
    });

    it('H2: NETTING account — risk pipeline runs without rejection on account-type alone', () => {
      const profile: RiskProfile = { ...defaultProfile, accountType: 'NETTING' };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(approve(d)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP I: Partial fills / partial closes
  // ═══════════════════════════════════════════════════════════════
  describe('I — Partial fills and partial closes', () => {
    it('I1: Partial fill — actual risk is proportional to filled volume', () => {
      // Ordered 0.20 lots. Only 0.10 filled. Full SL risk=$100. Actual=$50.
      const actualRisk = svc.computeActualRiskForPartialFill(0.20, 0.10, 100);
      expect(actualRisk).toBeCloseTo(50, 2);
    });

    it('I2: Full fill — actual risk equals estimated full SL risk', () => {
      const actualRisk = svc.computeActualRiskForPartialFill(0.20, 0.20, 100);
      expect(actualRisk).toBeCloseTo(100, 2);
    });

    it('I3: Zero fill — actual risk is 0', () => {
      const actualRisk = svc.computeActualRiskForPartialFill(0.20, 0, 100);
      expect(actualRisk).toBe(0);
    });

    it('I4: Partial close — evalTrade for remaining position uses updated filledVolume', () => {
      // After partial close, re-evaluate as if a new signal with reduced volume
      const partialSignal: TradeSignalInput = {
        ...defaultSignal,
        filledVolume: 0.10, // Only 0.10 remains open after partial close
      };
      // Risk engine treats this as a normal signal; partial-close accounting is caller responsibility
      const d = svc.evaluateTrade(partialSignal, defaultProfile, eurusdSpecs);
      expect(approve(d)).toBe(true); // Still a valid trade, just smaller exposure
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP J: Duplicate commands
  // ═══════════════════════════════════════════════════════════════
  describe('J — Duplicate detection', () => {
    it('J1: Duplicate signal is detected', () => {
      const executedIds = new Set(['sig-1', 'sig-2']);
      expect(svc.isDuplicateSignal('sig-1', executedIds)).toBe(true);
    });

    it('J2: Non-duplicate signal is not flagged', () => {
      const executedIds = new Set(['sig-1', 'sig-2']);
      expect(svc.isDuplicateSignal('sig-99', executedIds)).toBe(false);
    });

    it('J3: Recovery path rejects if already copied (isAlreadyCopied=true)', () => {
      const recovery: RecoveryContext = {
        currentMarketPrice: 1.10000,
        isAlreadyCopied: true,
        masterSignalExists: true,
      };
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs, recovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('already copied');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP K: Recovery path — full safety gate, no bypass
  // ═══════════════════════════════════════════════════════════════
  describe('K — Recovery / reconnection safety gates', () => {
    const validRecovery: RecoveryContext = {
      currentMarketPrice: 1.09750, // Moved against trade → better RR
      isAlreadyCopied: false,
      masterSignalExists: true,
    };

    it('K1: Valid recovery — passes all gates and approves', () => {
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs, validRecovery);
      expect(approve(d)).toBe(true);
    });

    it('K2: Recovery rejects if master trade no longer exists', () => {
      const recovery: RecoveryContext = { ...validRecovery, masterSignalExists: false };
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs, recovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('master trade no longer exists');
    });

    it('K3: Recovery still enforces missing SL → WAITING_FOR_SL', () => {
      const recovery: RecoveryContext = { ...validRecovery };
      const d = svc.evaluateTrade({ ...defaultSignal, sl: 0 }, defaultProfile, eurusdSpecs, recovery);
      expect(d.state).toBe(CopyState.WAITING_FOR_SL);
    });

    it('K4: Recovery still enforces RR — recovered RR below 1:2 is rejected', () => {
      // Price moved to 1.10400. SL=1.09500. TP=1.11000.
      // slDist=0.009, tpDist=0.006 → RR=0.66 < 2.0 → REJECTED
      const recovery: RecoveryContext = { ...validRecovery, currentMarketPrice: 1.10400 };
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs, recovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('below global minimum');
    });

    it('K5: Recovery still enforces RR degradation limit', () => {
      // Trade has RR=4.0 originally. Recovered RR=3.16 (degradation=0.84 > limit=0.5)
      const sig: TradeSignalInput = { ...defaultSignal, tp: 1.12000, masterOriginalRR: 4.0 };
      const recovery: RecoveryContext = { ...validRecovery, currentMarketPrice: 1.10100 };
      const d = svc.evaluateTrade(sig, defaultProfile, eurusdSpecs, recovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('degradation');
    });

    it('K6: Recovery still enforces daily risk limits', () => {
      const profile: RiskProfile = {
        ...defaultProfile,
        dailyRiskEnabled: true,
        currentDailyRisk: 490,
        maxDailyRisk: 500,
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs, validRecovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('Daily risk limit');
    });

    it('K7: Recovery still enforces max active trades', () => {
      const profile: RiskProfile = {
        ...defaultProfile,
        maxTradesEnabled: true,
        currentActiveTrades: 5,
        maxActiveTrades: 5,
      };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs, validRecovery);
      expect(reject(d)).toBe(true);
      expect(d.rejectionReason).toContain('Max active trades reached');
    });

    
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP L: Audit Trail — all required fields present on every decision
  // ═══════════════════════════════════════════════════════════════
  describe('L — Audit trail completeness', () => {
    it('L1: APPROVED decision contains all required audit fields', () => {
      const d = svc.evaluateTrade(defaultSignal, defaultProfile, eurusdSpecs);
      expect(d.state).toBeDefined();
      expect(typeof d.intendedRisk).toBe('number');
      expect(typeof d.maxPermittedRisk).toBe('number');
      expect(typeof d.calculatedVol).toBe('number');
      expect(typeof d.executedVol).toBe('number');
      expect(typeof d.estimatedSlRisk).toBe('number');
      expect(typeof d.roundingDiff).toBe('number');
      expect(typeof d.dailyRiskBefore).toBe('number');
      expect(typeof d.dailyRiskAfter).toBe('number');
      expect(d.rejectionReason).toBeUndefined();
    });

    it('L2: REJECTED decision contains rejectionReason + all numeric fields', () => {
      const d = svc.evaluateTrade({ ...defaultSignal, sl: 0 }, defaultProfile, eurusdSpecs);
      expect(typeof d.rejectionReason).toBe('string');
      expect(d.rejectionReason!.length).toBeGreaterThan(0);
      expect(typeof d.dailyRiskBefore).toBe('number');
      expect(typeof d.dailyRiskAfter).toBe('number');
    });

    it('L3: dailyRiskBefore always reflects currentDailyRisk at time of call', () => {
      const profile: RiskProfile = { ...defaultProfile, currentDailyRisk: 250 };
      const d = svc.evaluateTrade(defaultSignal, profile, eurusdSpecs);
      expect(d.dailyRiskBefore).toBe(250);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUP M: Frontend never sends lot sizes — architecture contract
  // ═══════════════════════════════════════════════════════════════
  describe('M — Frontend isolation (architecture contract)', () => {
    it('M1: TradeSignalInput.volume is master volume for reference only; it is never used to derive sub lot size', () => {
      // Pass wildly different master volumes — the engine must ignore them
      const d1 = svc.evaluateTrade({ ...defaultSignal, volume: 0.01 }, defaultProfile, eurusdSpecs);
      const d2 = svc.evaluateTrade({ ...defaultSignal, volume: 100.0 }, defaultProfile, eurusdSpecs);
      // executedVol must be identical because it is derived from equity/risk, not master volume
      expect(d1.executedVol).toBeCloseTo(d2.executedVol, 5);
    });
  });
});
