import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from '../services/currency.service';
import { LotCalculatorService } from '../services/lot-calculator.service';

describe('LotCalculatorService - Exhaustive Risk Multiplier & SL Matrix', () => {
  let lotCalc: LotCalculatorService;
  let currencyService: CurrencyService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService, LotCalculatorService],
    }).compile();

    lotCalc = module.get<LotCalculatorService>(LotCalculatorService);
    currencyService = module.get<CurrencyService>(CurrencyService);
  });

  // =========================================================================
  // SUITE 1: 4 RISK MULTIPLIER MODES
  // =========================================================================
  describe('Suite 1: 4 Risk Multiplier Modes', () => {
    it('1.1 FIXED_LOT: executes exact requested volume', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 1000, equity: 1000, currency: 'USD' },
        undefined,
        { riskType: 'FIXED_LOT', fixedLotSize: 0.07 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.5, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('FIXED_LOT');
      expect(res.finalVolume).toBe(0.07);
      expect(res.maxLotClamped).toBe(false);
    });

    it('1.2 FIXED_LOT with Max Lot Cap: clamps volume exceeding cap', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'FIXED_LOT', fixedLotSize: 5.0, maxLotCap: 1.5 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 1.0, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(1.5);
      expect(res.maxLotClamped).toBe(true);
      expect(res.warnings?.[0]).toContain('capped by user Max Lot Cap');
    });

    it('1.3 BALANCE_MULTIPLIER: scales 1:1 proportionally to balance ratio', () => {
      // Master: $10,000, Sub: $5,000 (ratio 0.5), Multiplier 1.0, Master Vol: 0.10 -> Expected: 0.05
      const res = lotCalc.calculateLotSize(
        { balance: 5000, equity: 5000, currency: 'USD' },
        { balance: 10000, currency: 'USD' },
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('BALANCE_MULTIPLIER');
      expect(res.finalVolume).toBe(0.05);
    });

    it('1.4 BALANCE_MULTIPLIER with custom multiplier: scales by 2.0x', () => {
      // Master: $10,000, Sub: $2,000 (ratio 0.2), Multiplier 2.0x -> 0.4x master vol. Master: 1.00 -> 0.40
      const res = lotCalc.calculateLotSize(
        { balance: 2000, equity: 2000, currency: 'USD' },
        { balance: 10000, currency: 'USD' },
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 2.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 1.0, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(0.40);
    });

    it('1.5 EQUITY_MULTIPLIER: scales proportionally based on floating equity', () => {
      // Master: $20,000 equity, Sub: $10,000 equity (ratio 0.5), Master: 0.20 -> Expected: 0.10
      const res = lotCalc.calculateLotSize(
        { balance: 12000, equity: 10000, currency: 'USD' },
        { balance: 25000, equity: 20000, currency: 'USD' },
        { riskType: 'EQUITY_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.20, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('EQUITY_MULTIPLIER');
      expect(res.finalVolume).toBe(0.10);
    });

    it('1.6 RISK_PERCENT: standard SL risk model calculation', () => {
      // Sub: $1,000, Risk: 1% ($10 USD), EURUSD 20 pips ($200 per lot) -> 10 / 200 = 0.05 lots
      const res = lotCalc.calculateLotSize(
        { balance: 1000, equity: 1000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('SL_RISK_PERCENT');
      expect(res.cashRiskUSD).toBe(10);
      expect(res.lossPerLotUSD).toBe(200);
      expect(res.finalVolume).toBe(0.05);
    });
  });

  // =========================================================================
  // SUITE 2: ACCOUNT SIZE SPECTRUM ($50 to $10,000,000) UNDER RISK_PERCENT
  // =========================================================================
  describe('Suite 2: Account Size Spectrum ($50 to $10,000,000)', () => {
    const testCases = [
      { balance: 50,       riskPct: 10,   pips: 20, expected: 0.02 }, // $50 * 10% = $5 / $200 = 0.025 -> stepped 0.02
      { balance: 100,      riskPct: 10,   pips: 20, expected: 0.05 }, // $100 * 10% = $10 / $200 = 0.05
      { balance: 250,      riskPct: 2,    pips: 25, expected: 0.02 }, // $250 * 2% = $5 / $250 = 0.02
      { balance: 500,      riskPct: 1,    pips: 20, expected: 0.02 }, // $500 * 1% = $5 / $200 = 0.025 -> 0.02
      { balance: 1000,     riskPct: 1,    pips: 20, expected: 0.05 }, // $1000 * 1% = $10 / $200 = 0.05
      { balance: 2500,     riskPct: 2,    pips: 20, expected: 0.25 }, // $2500 * 2% = $50 / $200 = 0.25
      { balance: 5000,     riskPct: 1,    pips: 20, expected: 0.25 }, // $5000 * 1% = $50 / $200 = 0.25
      { balance: 10000,    riskPct: 1,    pips: 20, expected: 0.50 }, // $10000 * 1% = $100 / $200 = 0.50
      { balance: 25000,    riskPct: 0.5,  pips: 20, expected: 0.62 }, // $25000 * 0.5% = $125 / $200 = 0.625 -> 0.62
      { balance: 50000,    riskPct: 1,    pips: 20, expected: 2.50 }, // $50000 * 1% = $500 / $200 = 2.50
      { balance: 100000,   riskPct: 0.5,  pips: 20, expected: 2.50 }, // $100000 * 0.5% = $500 / $200 = 2.50
      { balance: 200000,   riskPct: 1,    pips: 20, expected: 10.0 }, // $200000 * 1% = $2000 / $200 = 10.0
      { balance: 500000,   riskPct: 0.25, pips: 20, expected: 6.25 }, // $500000 * 0.25% = $1250 / $200 = 6.25
      { balance: 1000000,  riskPct: 0.5,  pips: 20, expected: 25.0 }, // $1M * 0.5% = $5000 / $200 = 25.0
      { balance: 5000000,  riskPct: 0.1,  pips: 20, expected: 25.0 }, // $5M * 0.1% = $5000 / $200 = 25.0
      { balance: 10000000, riskPct: 0.1,  pips: 20, expected: 50.0 }, // $10M * 0.1% = $10000 / $200 = 50.0
    ];

    testCases.forEach((tc) => {
      it(`calculates accurate lot size for balance $${tc.balance.toLocaleString()} @ ${tc.riskPct}% risk (${tc.pips} pips)`, () => {
        const slDist = tc.pips * 0.0001;
        const res = lotCalc.calculateLotSize(
          { balance: tc.balance, equity: tc.balance, currency: 'USD', freeMargin: tc.balance * 10 },
          undefined,
          { riskType: 'RISK_PERCENT', riskPercentage: tc.riskPct },
          { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.1000 - slDist },
        );
        expect(res.finalVolume).toBe(tc.expected);
      });
    });
  });

  // =========================================================================
  // SUITE 3: ASSET CLASSES & CONTRACT SPECIFICATIONS
  // =========================================================================
  describe('Suite 3: Multi-Asset Class Risk Calculation', () => {
    it('3.1 Gold (XAUUSD): 100 oz contract size ($1 movement = $100/lot)', () => {
      // $10,000 account, 1% risk ($100). Entry: $2,700, SL: $2,695 ($5 movement = $500 per lot).
      // Target: $100 / $500 = 0.20 lots
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'XAUUSD.m', orderType: 'BUY', masterVolume: 0.1, entryPrice: 2700.0, stopLoss: 2695.0 },
      );
      expect(res.lossPerLotUSD).toBe(500);
      expect(res.finalVolume).toBe(0.20);
    });

    it('3.2 Silver (XAGUSD): 5,000 oz contract size ($1 movement = $5,000/lot)', () => {
      // $10,000 account, 1% risk ($100). Entry: $32.00, SL: $31.80 ($0.20 movement = $1,000 per lot).
      // Target: $100 / $1,000 = 0.10 lots
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'XAGUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 32.00, stopLoss: 31.80 },
      );
      expect(res.lossPerLotUSD).toBe(1000);
      expect(res.finalVolume).toBe(0.10);
    });

    it('3.3 Crude Oil (USOIL): 1,000 barrels contract size ($1 movement = $1,000/lot)', () => {
      // $10,000 account, 2% risk ($200). Entry: $75.00, SL: $74.50 ($0.50 movement = $500 per lot).
      // Target: $200 / $500 = 0.40 lots
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'USOIL', orderType: 'BUY', masterVolume: 0.1, entryPrice: 75.00, stopLoss: 74.50 },
      );
      expect(res.lossPerLotUSD).toBe(500);
      expect(res.finalVolume).toBe(0.40);
    });

    it('3.4 Crypto (BTCUSD): 1 coin contract size ($1 movement = $1/lot)', () => {
      // $10,000 account, 2% risk ($200). Entry: $68,000, SL: $66,000 ($2,000 movement = $2,000 per lot).
      // Target: $200 / $2,000 = 0.10 lots
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'BTCUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 68000, stopLoss: 66000 },
      );
      expect(res.lossPerLotUSD).toBe(2000);
      expect(res.finalVolume).toBe(0.10);
    });

    it('3.5 Indices (US30): 1 point = $1/lot', () => {
      // $10,000 account, 1% risk ($100). Entry: 42,000, SL: 41,800 (200 pts = $200 per lot).
      // Target: $100 / $200 = 0.50 lots
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'US30', orderType: 'BUY', masterVolume: 0.1, entryPrice: 42000, stopLoss: 41800 },
      );
      expect(res.lossPerLotUSD).toBe(200);
      expect(res.finalVolume).toBe(0.50);
    });

    it('3.6 Forex USD-base pair (USDJPY): converted by entry price', () => {
      // Entry: 150.00, SL: 149.00 (100 pips). Loss in JPY = 100 * 100,000 = 100,000 JPY.
      // In USD = 100,000 / 150 = $666.67 per lot.
      // Sub: $10,000 @ 2% risk ($200). Target: $200 / $666.67 = 0.30 lots.
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'USDJPY', orderType: 'BUY', masterVolume: 0.1, entryPrice: 150.00, stopLoss: 149.00 },
      );
      expect(res.finalVolume).toBe(0.30);
    });

    it('3.7 Forex Cross pair (EURGBP): converts quote currency to USD', () => {
      // Sub: $10,000 @ 1% risk ($100). Entry: 0.8500, SL: 0.8480 (20 pips = 200 GBP loss).
      // GBP fallback rate: 0.78 (1 GBP = $1.282 USD). 200 GBP = $256.41 loss per lot.
      // Target: $100 / $256.41 = 0.39 lots.
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURGBP', orderType: 'BUY', masterVolume: 0.1, entryPrice: 0.8500, stopLoss: 0.8480 },
      );
      expect(res.finalVolume).toBe(0.39);
    });
  });

  // =========================================================================
  // SUITE 4: MULTI-CURRENCY SUB ACCOUNTS (NGN, EUR, GBP, JPY)
  // =========================================================================
  describe('Suite 4: Multi-Currency Account Risk Normalization', () => {
    it('4.1 NGN Sub Account (₦310,000 balance @ 1600 NGN/USD)', () => {
      // Risk: 5% = ₦15,500 (~$9.6875 USD cash risk). EURUSD 20 pips ($200 loss per lot).
      // Target: $9.6875 / $200 = 0.0484 -> stepped 0.04 lots!
      const res = lotCalc.calculateLotSize(
        { balance: 310000, equity: 310000, currency: 'NGN' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 5.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.cashRiskAccountCurrency).toBe(15500);
      expect(Math.abs(res.cashRiskUSD - 9.6875)).toBeLessThan(0.01);
      expect(res.finalVolume).toBe(0.04);
    });

    it('4.2 EUR Sub Account (€10,000 balance @ 0.92 EUR/USD = $10,869.57 USD)', () => {
      // Risk: 1% = €100 (~$108.70 USD). EURUSD 20 pips ($200/lot).
      // Target: $108.70 / $200 = 0.5435 -> 0.54 lots.
      const res = lotCalc.calculateLotSize(
        { balance: 10000, equity: 10000, currency: 'EUR' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.cashRiskAccountCurrency).toBe(100);
      expect(res.finalVolume).toBe(0.54);
    });

    it('4.3 GBP Sub Account (£5,000 balance @ 0.78 GBP/USD = $6,410.26 USD)', () => {
      // Risk: 2% = £100 (~$128.21 USD). EURUSD 25 pips ($250/lot).
      // Target: $128.21 / $250 = 0.5128 -> 0.51 lots.
      const res = lotCalc.calculateLotSize(
        { balance: 5000, equity: 5000, currency: 'GBP' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0975 },
      );
      expect(res.cashRiskAccountCurrency).toBe(100);
      expect(res.finalVolume).toBe(0.51);
    });
  });

  // =========================================================================
  // SUITE 5: SAFETY CONSTRAINTS & EDGE CASES
  // =========================================================================
  describe('Suite 5: Safety Constraints, Margin Protection & Precision', () => {
    it('5.1 Max Lot Hard Cap clamps large calculated volume', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 100000, equity: 100000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 5.0, maxLotCap: 3.0 }, // Raw would be 25 lots
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(3.0);
      expect(res.maxLotClamped).toBe(true);
    });

    it('5.2 Free Margin Safety clamps trade if free margin cannot support the position', () => {
      // Small balance ($100), leverage 1:100. Gold trade @ $2,700 requires $2,700 margin per lot.
      // $100 free margin can only safely support ~0.03 lots.
      const res = lotCalc.calculateLotSize(
        { balance: 100, equity: 100, freeMargin: 100, currency: 'USD', leverage: 100 },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 10.0 }, // Target risk $10 over $1 SL = 10 lots requested!
        { symbol: 'XAUUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 2700, stopLoss: 2699 },
      );
      expect(res.finalVolume).toBeLessThanOrEqual(0.04);
      expect(res.marginClamped).toBe(true);
    });

    it('5.3 Margin calculation for USD-base pairs (e.g. USDJPY) correctly avoids multiplying by entryPrice', () => {
      // Standard forex USDJPY: 100,000 units / 100 leverage = $1,000 USD margin per lot
      const margin = lotCalc.calculateMarginPerLotInUSD('USDJPY', 150.00, 100);
      expect(margin).toBe(1000);
    });

    it('5.4 Margin calculation for USD-quote pairs (e.g. EURUSD) correctly uses (contractSize * entryPrice) / leverage', () => {
      // EURUSD @ 1.10: 100,000 * 1.10 / 100 = $1,100 USD margin per lot
      const margin = lotCalc.calculateMarginPerLotInUSD('EURUSD', 1.10, 100);
      expect(margin).toBe(1100);
    });

    it('5.5 Missing or zero Stop Loss falls back to proportional scaling with safety warning', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 5000, equity: 5000, currency: 'USD' },
        { balance: 10000, currency: 'USD' },
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 0 },
      );
      expect(res.calculationMethod).toBe('FALLBACK_PROPORTIONAL');
      expect(res.finalVolume).toBe(0.05); // 5k / 10k * 0.10
      expect(res.warnings?.[0]).toContain('Stop Loss is 0 or unquoted');
    });

    it('5.6 Custom broker constraints (minLot=0.1, lotStep=0.1, maxLot=20)', () => {
      const res = lotCalc.calculateLotSize(
        { balance: 1000, equity: 1000, currency: 'USD' },
        undefined,
        { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.01, entryPrice: 1.1000, stopLoss: 1.0980 },
        { minLot: 0.1, maxLot: 20, lotStep: 0.1 },
      );
      // Raw was 0.05, but minLot is 0.10
      expect(res.finalVolume).toBe(0.10);
    });

    it('5.7 IEEE 754 precision rounding handles binary floating point issues without truncation', () => {
      const stepped1 = lotCalc.stepAndClamp(0.2899999999999996, 0.01, 100, 0.01);
      expect(stepped1).toBe(0.29);

      const stepped2 = lotCalc.stepAndClamp(1.23456, 0.001, 100, 0.001);
      expect(stepped2).toBe(1.234);
    });
  });
});
