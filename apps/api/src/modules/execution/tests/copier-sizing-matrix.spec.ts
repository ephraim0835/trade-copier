import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from '../../risk-engine/services/currency.service';
import { LotCalculatorService } from '../../risk-engine/services/lot-calculator.service';

describe('Copier Sizing & Risk Multiplier Accuracy Matrix', () => {
  let lotCalc: LotCalculatorService;
  let currencyService: CurrencyService;

  // Real Database Accounts
  const masterAccount = {
    login: '2002168199',
    balance: 1055.44,
    equity: 1055.44,
    currency: 'USD',
  };

  const subAccounts = {
    sub1_micro_usd: {
      login: '2002168241',
      balance: 99.77,
      equity: 99.77,
      freeMargin: 99.77,
      currency: 'USD',
      leverage: 100,
    },
    sub2_ngn: {
      login: '6219739',
      balance: 310000.0, // ₦310,000 NGN (~$193.75 USD @ 1600 NGN/USD)
      equity: 310000.0,
      freeMargin: 310000.0,
      currency: 'NGN',
      leverage: 100,
    },
    sub3_large_usd: {
      login: '6228137',
      balance: 19848.10,
      equity: 19848.10,
      freeMargin: 19848.10,
      currency: 'USD',
      leverage: 100,
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService, LotCalculatorService],
    }).compile();

    lotCalc = module.get<LotCalculatorService>(LotCalculatorService);
    currencyService = module.get<CurrencyService>(CurrencyService);
  });

  // =========================================================================
  // 1. FIXED_LOT MODE ACCURACY ACROSS ALL SUBS
  // =========================================================================
  describe('1. FIXED_LOT Mode Accuracy', () => {
    const fixedLotSizes = [0.01, 0.03, 0.07, 0.15, 0.50];

    fixedLotSizes.forEach((fixedSize) => {
      it(`executes exact fixed volume of ${fixedSize} lots on Sub 1 ($99.77 USD) regardless of master volume`, () => {
        const res = lotCalc.calculateLotSize(
          subAccounts.sub1_micro_usd,
          masterAccount,
          { riskType: 'FIXED_LOT', fixedLotSize: fixedSize },
          { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 1.0, entryPrice: 1.1000, stopLoss: 1.0980 },
        );
        expect(res.calculationMethod).toBe('FIXED_LOT');
        expect(res.finalVolume).toBe(fixedSize);
      });

      it(`executes exact fixed volume of ${fixedSize} lots on Sub 2 (₦310k NGN)`, () => {
        const res = lotCalc.calculateLotSize(
          subAccounts.sub2_ngn,
          masterAccount,
          { riskType: 'FIXED_LOT', fixedLotSize: fixedSize },
          { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 1.0980 },
        );
        expect(res.finalVolume).toBe(fixedSize);
      });

      it(`executes exact fixed volume of ${fixedSize} lots on Sub 3 ($19.8k USD)`, () => {
        const res = lotCalc.calculateLotSize(
          subAccounts.sub3_large_usd,
          masterAccount,
          { riskType: 'FIXED_LOT', fixedLotSize: fixedSize },
          { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 5.0, entryPrice: 1.1000, stopLoss: 1.0980 },
        );
        expect(res.finalVolume).toBe(fixedSize);
      });
    });

    it('enforces user Max Lot Cap in FIXED_LOT mode', () => {
      const res = lotCalc.calculateLotSize(
        subAccounts.sub3_large_usd,
        masterAccount,
        { riskType: 'FIXED_LOT', fixedLotSize: 5.0, maxLotCap: 1.25 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 5.0, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(1.25);
      expect(res.maxLotClamped).toBe(true);
    });
  });

  // =========================================================================
  // 2. BALANCE_MULTIPLIER & EQUITY_MULTIPLIER ACCURACY
  // =========================================================================
  describe('2. BALANCE_MULTIPLIER & EQUITY_MULTIPLIER Modes Accuracy', () => {
    it('BALANCE_MULTIPLIER (1.0x) scales volume based on Capital Ratio', () => {
      // Master: $1,055.44, Sub 3: $19,848.10 -> Ratio = 19848.10 / 1055.44 = 18.8055
      // Master places 0.10 lots -> Sub 3 expected: 0.10 * 18.8055 = 1.88 lots!
      const res = lotCalc.calculateLotSize(
        subAccounts.sub3_large_usd,
        masterAccount,
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('BALANCE_MULTIPLIER');
      expect(res.finalVolume).toBe(1.88);
    });

    it('BALANCE_MULTIPLIER with 2.0x multiplier doubles proportional volume', () => {
      // 0.10 * 18.8055 * 2.0 = 3.76 lots!
      const res = lotCalc.calculateLotSize(
        subAccounts.sub3_large_usd,
        masterAccount,
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 2.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(3.76);
    });

    it('BALANCE_MULTIPLIER on NGN Account normalizes via exchange rate', () => {
      // Sub 2: ₦310,000 / 1600 = $193.75 USD.
      // Master: $1,055.44 USD.
      // Ratio = 193.75 / 1055.44 = 0.18357
      // Master places 1.00 lots -> Sub 2 expected: 0.18 lots!
      const res = lotCalc.calculateLotSize(
        subAccounts.sub2_ngn,
        masterAccount,
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 1.0, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(0.18);
    });

    it('BALANCE_MULTIPLIER on Sub 1 ($99.77) with small master trade respects minLot (0.01)', () => {
      // Sub 1: $99.77 / $1055.44 = 0.0945 ratio.
      // Master places 0.05 lots -> 0.05 * 0.0945 = 0.0047 -> clamps to minLot 0.01!
      const res = lotCalc.calculateLotSize(
        subAccounts.sub1_micro_usd,
        masterAccount,
        { riskType: 'BALANCE_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.05, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.finalVolume).toBe(0.01);
    });

    it('EQUITY_MULTIPLIER scales dynamically by floating equity', () => {
      // Master has floating drawdown (equity $800 vs balance $1055).
      // Sub 3 has floating profit (equity $22,000 vs balance $19848).
      // Ratio = 22000 / 800 = 27.5. Master 0.10 lots -> Sub expected: 2.75 lots.
      const res = lotCalc.calculateLotSize(
        { ...subAccounts.sub3_large_usd, equity: 22000 },
        { ...masterAccount, equity: 800 },
        { riskType: 'EQUITY_MULTIPLIER', lotMultiplier: 1.0 },
        { symbol: 'EURUSD', orderType: 'BUY', masterVolume: 0.10, entryPrice: 1.1000, stopLoss: 1.0980 },
      );
      expect(res.calculationMethod).toBe('EQUITY_MULTIPLIER');
      expect(res.finalVolume).toBe(2.75);
    });
  });

  // =========================================================================
  // 3. RISK_PERCENT FROM SL: MULTIPLE RISK % LEVELS & SL DISTANCES
  // =========================================================================
  describe('3. RISK_PERCENT from SL: Comprehensive Matrix', () => {
    // Test multiple risk percentages per trade: 0.25%, 0.5%, 1.0%, 1.5%, 2.0%, 3.0%, 5.0%, 10.0%
    const riskPercentages = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];

    describe('3.1 Sub 3: Large USD Account ($19,848.10) across EURUSD SL distances', () => {
      const slScenarios = [
        { pips: 10, dist: 0.0010, lossPerLot: 100 },
        { pips: 20, dist: 0.0020, lossPerLot: 200 },
        { pips: 35, dist: 0.0035, lossPerLot: 350 },
        { pips: 50, dist: 0.0050, lossPerLot: 500 },
        { pips: 100, dist: 0.0100, lossPerLot: 1000 },
      ];

      riskPercentages.forEach((riskPct) => {
        slScenarios.forEach((sl) => {
          it(`calculates exact lots for ${riskPct}% risk with ${sl.pips} pips SL`, () => {
            const targetCashRisk = 19848.10 * (riskPct / 100);
            const rawExpectedLots = targetCashRisk / sl.lossPerLot;
            const expectedLots = Math.floor((rawExpectedLots + 1e-7) / 0.01) * 0.01;
            const finalExpected = Number(expectedLots.toFixed(2));

            const res = lotCalc.calculateLotSize(
              subAccounts.sub3_large_usd,
              masterAccount,
              { riskType: 'RISK_PERCENT', riskPercentage: riskPct },
              {
                symbol: 'EURUSD',
                orderType: 'BUY',
                masterVolume: 0.1,
                entryPrice: 1.1000,
                stopLoss: 1.1000 - sl.dist,
              },
            );

            expect(res.calculationMethod).toBe('SL_RISK_PERCENT');
            if (res.marginClamped) {
              expect(res.finalVolume).toBeLessThanOrEqual(finalExpected);
              expect(res.marginClamped).toBe(true);
            } else {
              expect(res.finalVolume).toBe(finalExpected);
            }
            // Cash risk actually committed must not exceed target cash risk + 1 pip tolerance
            const actualMaxLoss = res.finalVolume * sl.lossPerLot;
            expect(actualMaxLoss).toBeLessThanOrEqual(targetCashRisk + 0.01);
          });
        });
      });
    });

    describe('3.2 Sub 2: NGN Account (₦310,000 NGN) across multiple risk % levels', () => {
      // ₦310,000 @ 1600 NGN/USD = $193.75 USD
      const capitalUSD = 193.75;

      riskPercentages.forEach((riskPct) => {
        it(`calculates exact lots for ${riskPct}% risk on NGN account over 20 pips EURUSD ($200/lot)`, () => {
          const targetCashRiskUSD = capitalUSD * (riskPct / 100);
          const rawExpectedLots = targetCashRiskUSD / 200;
          const expectedLots = Math.max(0.01, Math.floor((rawExpectedLots + 1e-7) / 0.01) * 0.01);
          const finalExpected = Number(expectedLots.toFixed(2));

          const res = lotCalc.calculateLotSize(
            subAccounts.sub2_ngn,
            masterAccount,
            { riskType: 'RISK_PERCENT', riskPercentage: riskPct },
            {
              symbol: 'EURUSD',
              orderType: 'BUY',
              masterVolume: 0.01,
              entryPrice: 1.1000,
              stopLoss: 1.0980,
            },
          );

          expect(res.finalVolume).toBe(finalExpected);
          expect(res.cashRiskAccountCurrency).toBe(310000 * (riskPct / 100));
        });
      });
    });

    describe('3.3 Sub 1: Micro USD Account ($99.77) across multiple risk % levels', () => {
      riskPercentages.forEach((riskPct) => {
        it(`calculates exact lots for ${riskPct}% risk on $99.77 account over 20 pips EURUSD`, () => {
          const targetCashRiskUSD = 99.77 * (riskPct / 100);
          const rawExpectedLots = targetCashRiskUSD / 200;
          const expectedLots = Math.max(0.01, Math.floor((rawExpectedLots + 1e-7) / 0.01) * 0.01);
          const finalExpected = Number(expectedLots.toFixed(2));

          const res = lotCalc.calculateLotSize(
            subAccounts.sub1_micro_usd,
            masterAccount,
            { riskType: 'RISK_PERCENT', riskPercentage: riskPct },
            {
              symbol: 'EURUSD',
              orderType: 'BUY',
              masterVolume: 0.01,
              entryPrice: 1.1000,
              stopLoss: 1.0980,
            },
          );

          expect(res.finalVolume).toBe(finalExpected);
        });
      });
    });

    describe('3.4 Multi-Asset Stop Loss Risk Calculation (Gold, Bitcoin, USDJPY)', () => {
      it('Gold (XAUUSD): $5.00 SL distance = $500 loss/lot on Sub 3 @ 1.0% risk ($198.48)', () => {
        // Target: $198.48 / $500 = 0.3969 -> stepped 0.39 lots
        const res = lotCalc.calculateLotSize(
          subAccounts.sub3_large_usd,
          masterAccount,
          { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
          { symbol: 'XAUUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 2700.0, stopLoss: 2695.0 },
        );
        expect(res.lossPerLotUSD).toBe(500);
        expect(res.finalVolume).toBe(0.39);
      });

      it('Gold (XAUUSD): $15.00 SL distance = $1,500 loss/lot on Sub 3 @ 2.0% risk ($396.96)', () => {
        // Target: $396.96 / $1,500 = 0.2646 -> stepped 0.26 lots
        const res = lotCalc.calculateLotSize(
          subAccounts.sub3_large_usd,
          masterAccount,
          { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
          { symbol: 'XAUUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 2700.0, stopLoss: 2685.0 },
        );
        expect(res.lossPerLotUSD).toBe(1500);
        expect(res.finalVolume).toBe(0.26);
      });

      it('Bitcoin (BTCUSD): $1,200 SL distance = $1,200 loss/lot on Sub 3 @ 1.5% risk ($297.72)', () => {
        // Target: $297.72 / $1,200 = 0.2481 -> stepped 0.24 lots
        const res = lotCalc.calculateLotSize(
          subAccounts.sub3_large_usd,
          masterAccount,
          { riskType: 'RISK_PERCENT', riskPercentage: 1.5 },
          { symbol: 'BTCUSD', orderType: 'BUY', masterVolume: 0.1, entryPrice: 68000, stopLoss: 66800 },
        );
        expect(res.lossPerLotUSD).toBe(1200);
        expect(res.finalVolume).toBe(0.24);
      });

      it('USDJPY: 50 pips SL @ 150.00 entry price = $333.33 loss/lot on Sub 3 @ 1.0% risk ($198.48)', () => {
        // Loss per lot in USD: (0.50 * 100,000) / 150.00 = 50,000 / 150 = $333.33
        // Target: $198.48 / $333.33 = 0.5954 -> stepped 0.59 lots
        const res = lotCalc.calculateLotSize(
          subAccounts.sub3_large_usd,
          masterAccount,
          { riskType: 'RISK_PERCENT', riskPercentage: 1.0 },
          { symbol: 'USDJPY', orderType: 'BUY', masterVolume: 0.1, entryPrice: 150.00, stopLoss: 149.50 },
        );
        expect(res.lossPerLotUSD).toBe(333.3333);
        expect(res.finalVolume).toBe(0.59);
      });
    });
  });

  // =========================================================================
  // 4. MULTIPLE RISK PERCENTAGES SIMULTANEOUS COPY SCENARIO
  // =========================================================================
  describe('4. Simultaneous Copy Scenario: 1 Master Trade -> 3 Different Subs with Different Risk %', () => {
    it('accurately distributes a single Master trade across 3 subs with different individual risk settings', () => {
      // MASTER OPENS:
      // EURUSD BUY 0.20 lots, Entry: 1.1050, SL: 1.1015 (35 pips = $350 loss/lot)
      const masterTrade = {
        symbol: 'EURUSD',
        orderType: 'BUY',
        masterVolume: 0.20,
        entryPrice: 1.1050,
        stopLoss: 1.1015,
      };

      // Sub 1: Small USD ($99.77) configured with 5% risk ($4.99 cash risk)
      // $4.99 / $350 = 0.014 -> 0.01 lots
      const copySub1 = lotCalc.calculateLotSize(
        subAccounts.sub1_micro_usd,
        masterAccount,
        { riskType: 'RISK_PERCENT', riskPercentage: 5.0 },
        masterTrade,
      );
      expect(copySub1.finalVolume).toBe(0.01);
      expect(copySub1.lossPerLotUSD).toBe(350);

      // Sub 2: NGN Account (₦310,000) configured with 3% risk (₦9,300 = $5.81 USD cash risk)
      // $5.81 / $350 = 0.0166 -> 0.01 lots
      const copySub2 = lotCalc.calculateLotSize(
        subAccounts.sub2_ngn,
        masterAccount,
        { riskType: 'RISK_PERCENT', riskPercentage: 3.0 },
        masterTrade,
      );
      expect(copySub2.finalVolume).toBe(0.01);

      // Sub 3: Large USD ($19,848.10) configured with 2% risk ($396.96 cash risk)
      // $396.96 / $350 = 1.134 -> 1.13 lots!
      const copySub3 = lotCalc.calculateLotSize(
        subAccounts.sub3_large_usd,
        masterAccount,
        { riskType: 'RISK_PERCENT', riskPercentage: 2.0 },
        masterTrade,
      );
      expect(copySub3.finalVolume).toBe(1.13);

      // Verify that all 3 sub positions together safely execute without exceeding their target cash risk
      expect(copySub1.finalVolume * 350).toBeLessThanOrEqual(4.99 + 0.01);
      expect(copySub2.finalVolume * 350).toBeLessThanOrEqual(5.81 + 0.01);
      expect(copySub3.finalVolume * 350).toBeLessThanOrEqual(396.96 + 0.01);
    });
  });
});
