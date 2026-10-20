import { Injectable, Logger } from '@nestjs/common';
import { CurrencyService } from './currency.service';

export interface SubAccountRiskProfile {
  balance: number;
  equity: number;
  freeMargin?: number;
  currency: string;
  leverage?: number;
}

export interface MasterAccountProfile {
  balance: number;
  equity?: number;
  currency: string;
}

export interface CopyRiskSettings {
  riskType?: 'RISK_PERCENT' | 'FIXED_LOT' | 'BALANCE_MULTIPLIER' | 'EQUITY_MULTIPLIER' | string;
  riskPercentage?: number;
  fixedLotSize?: number;
  lotMultiplier?: number;
  maxLotCap?: number | null;
}

export interface TradeOrderInput {
  symbol: string;
  orderType: string;
  masterVolume: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
}

export interface BrokerSymbolConstraints {
  minLot?: number;
  maxLot?: number;
  lotStep?: number;
  contractSize?: number;
}

export interface LotCalculationResult {
  finalVolume: number;
  rawCalculatedVolume: number;
  cashRiskUSD: number;
  cashRiskAccountCurrency: number;
  lossPerLotUSD: number;
  slDistance: number;
  calculationMethod: 'SL_RISK_PERCENT' | 'FIXED_LOT' | 'BALANCE_MULTIPLIER' | 'EQUITY_MULTIPLIER' | 'FALLBACK_PROPORTIONAL';
  marginClamped: boolean;
  maxLotClamped?: boolean;
  warnings?: string[];
}

@Injectable()
export class LotCalculatorService {
  private readonly logger = new Logger(LotCalculatorService.name);

  constructor(private readonly currencyService: CurrencyService) {}

  /**
   * Universal, Institutional-Grade Lot Size Calculation
   * Supports:
   * 1. Multi-currency normalization (NGN, USD, EUR, GBP, JPY, ZAR, CAD, AUD)
   * 2. SL Distance calculation for Forex (Majors & Crosses), Metals (Gold, Silver), Crypto, Indices
   * 3. 4 Risk Multiplier Modes (RISK_PERCENT, FIXED_LOT, BALANCE_MULTIPLIER, EQUITY_MULTIPLIER)
   * 4. Free Margin safety ceiling to prevent 10019 RET_NO_MONEY rejects
   * 5. Broker volume stepping and clamping (minLot, maxLot, lotStep)
   * 6. User-defined Max Lot Hard Cap per trade ceiling
   */
  public calculateLotSize(
    sub: SubAccountRiskProfile,
    master: MasterAccountProfile | undefined,
    settings: CopyRiskSettings,
    trade: TradeOrderInput,
    constraints?: BrokerSymbolConstraints,
  ): LotCalculationResult {
    const warnings: string[] = [];
    const minLot = constraints?.minLot && constraints.minLot > 0 ? constraints.minLot : 0.01;
    let maxLot = constraints?.maxLot && constraints.maxLot > 0 ? constraints.maxLot : 100.0;
    
    // Enforce optional user Max Lot Hard Cap
    let maxLotClamped = false;
    if (settings.maxLotCap && settings.maxLotCap > 0) {
      if (settings.maxLotCap < maxLot) {
        maxLot = settings.maxLotCap;
      }
    }
    
    const lotStep = constraints?.lotStep && constraints.lotStep > 0 ? constraints.lotStep : 0.01;
    const leverage = sub.leverage && sub.leverage > 0 ? sub.leverage : 100;

    const riskType = (settings.riskType || 'RISK_PERCENT').toUpperCase();

    // 1. FIXED_LOT MODE
    if (riskType === 'FIXED_LOT') {
      const targetLot = settings.fixedLotSize && settings.fixedLotSize > 0 ? settings.fixedLotSize : minLot;
      if (settings.maxLotCap && settings.maxLotCap > 0 && targetLot > settings.maxLotCap) {
        maxLotClamped = true;
        warnings.push(`Fixed lot (${targetLot.toFixed(2)}) capped by user Max Lot Cap (${settings.maxLotCap.toFixed(2)}).`);
      }
      const finalVolume = this.stepAndClamp(targetLot, minLot, maxLot, lotStep);
      return {
        finalVolume,
        rawCalculatedVolume: targetLot,
        cashRiskUSD: 0,
        cashRiskAccountCurrency: 0,
        lossPerLotUSD: 0,
        slDistance: 0,
        calculationMethod: 'FIXED_LOT',
        marginClamped: false,
        maxLotClamped,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Capital in USD calculations
    const subCurrency = (sub.currency || 'USD').toUpperCase();
    const subBaseBalance = sub.balance > 0 ? sub.balance : (sub.equity > 0 ? sub.equity : 1000);
    const subCapitalUSD = this.currencyService.toUSD(subBaseBalance, subCurrency);

    const masterCurrency = (master?.currency || 'USD').toUpperCase();
    const masterBaseBalance = (master?.balance && master.balance > 0) ? master.balance : 10000;
    const masterCapitalUSD = this.currencyService.toUSD(masterBaseBalance, masterCurrency);

    // 2. BALANCE_MULTIPLIER MODE
    if (riskType === 'BALANCE_MULTIPLIER') {
      const multiplier = settings.lotMultiplier && settings.lotMultiplier > 0 ? settings.lotMultiplier : 1.0;
      const ratio = masterCapitalUSD > 0 ? (subCapitalUSD / masterCapitalUSD) : 1.0;
      const rawVol = trade.masterVolume * ratio * multiplier;
      if (settings.maxLotCap && settings.maxLotCap > 0 && rawVol > settings.maxLotCap) {
        maxLotClamped = true;
        warnings.push(`Balance-scaled volume (${rawVol.toFixed(2)}) capped by user Max Lot Cap (${settings.maxLotCap.toFixed(2)}).`);
      }
      const finalVolume = this.stepAndClamp(rawVol, minLot, maxLot, lotStep);
      return {
        finalVolume,
        rawCalculatedVolume: rawVol,
        cashRiskUSD: 0,
        cashRiskAccountCurrency: 0,
        lossPerLotUSD: 0,
        slDistance: 0,
        calculationMethod: 'BALANCE_MULTIPLIER',
        marginClamped: false,
        maxLotClamped,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // 3. EQUITY_MULTIPLIER MODE
    if (riskType === 'EQUITY_MULTIPLIER') {
      const multiplier = settings.lotMultiplier && settings.lotMultiplier > 0 ? settings.lotMultiplier : 1.0;
      const subEquity = sub.equity > 0 ? sub.equity : subBaseBalance;
      const subEquityUSD = this.currencyService.toUSD(subEquity, subCurrency);
      const masterEquity = (master?.equity && master.equity > 0) ? master.equity : masterBaseBalance;
      const masterEquityUSD = this.currencyService.toUSD(masterEquity, masterCurrency);
      const ratio = masterEquityUSD > 0 ? (subEquityUSD / masterEquityUSD) : 1.0;
      const rawVol = trade.masterVolume * ratio * multiplier;
      if (settings.maxLotCap && settings.maxLotCap > 0 && rawVol > settings.maxLotCap) {
        maxLotClamped = true;
        warnings.push(`Equity-scaled volume (${rawVol.toFixed(2)}) capped by user Max Lot Cap (${settings.maxLotCap.toFixed(2)}).`);
      }
      const finalVolume = this.stepAndClamp(rawVol, minLot, maxLot, lotStep);
      return {
        finalVolume,
        rawCalculatedVolume: rawVol,
        cashRiskUSD: 0,
        cashRiskAccountCurrency: 0,
        lossPerLotUSD: 0,
        slDistance: 0,
        calculationMethod: 'EQUITY_MULTIPLIER',
        marginClamped: false,
        maxLotClamped,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // 4. RISK_PERCENT MODE (Derived from Stop Loss distance)
    const riskPct = Math.max(0.1, Math.min(100.0, settings.riskPercentage ?? 1.0));
    const cashRiskUSD = subCapitalUSD * (riskPct / 100);
    const cashRiskAccountCurrency = subBaseBalance * (riskPct / 100);

    const slDistance = (trade.stopLoss > 0 && trade.entryPrice > 0)
      ? Math.abs(trade.entryPrice - trade.stopLoss)
      : 0;

    let lossPerLotUSD = 0;
    let calculationMethod: 'SL_RISK_PERCENT' | 'FALLBACK_PROPORTIONAL' = 'SL_RISK_PERCENT';
    let rawVol = 0;

    if (slDistance > 0) {
      lossPerLotUSD = this.calculateLossPerLotInUSD(trade.symbol, trade.entryPrice, slDistance);
      if (lossPerLotUSD > 0) {
        rawVol = cashRiskUSD / lossPerLotUSD;
      }
    }

    // If SL is missing (slDistance == 0) or loss per lot couldn't be determined, fallback to proportional
    if (rawVol <= 0) {
      calculationMethod = 'FALLBACK_PROPORTIONAL';
      warnings.push('Stop Loss is 0 or unquoted. Scaling lot size proportionally to USD capital ratio.');
      const capitalRatio = masterCapitalUSD > 0 ? (subCapitalUSD / masterCapitalUSD) : 1.0;
      rawVol = trade.masterVolume * capitalRatio;
    }

    // Margin Safety Check: Free margin constraint
    let marginClamped = false;
    const freeMargin = sub.freeMargin && sub.freeMargin > 0 ? sub.freeMargin : sub.balance;
    if (freeMargin > 0 && trade.entryPrice > 0) {
      const contractSize = constraints?.contractSize || this.getStandardContractSize(trade.symbol);
      const marginPerLotUSD = (contractSize * trade.entryPrice) / leverage;
      const freeMarginUSD = this.currencyService.toUSD(freeMargin, subCurrency);
      if (marginPerLotUSD > 0) {
        const maxAffordableLots = (freeMarginUSD * 0.85) / marginPerLotUSD; // 85% safety threshold
        if (maxAffordableLots > 0 && rawVol > maxAffordableLots) {
          marginClamped = true;
          warnings.push(`Raw volume (${rawVol.toFixed(2)}) exceeded safe free margin. Clamped to ${maxAffordableLots.toFixed(2)} lots.`);
          rawVol = maxAffordableLots;
        }
      }
    }

    if (settings.maxLotCap && settings.maxLotCap > 0 && rawVol > settings.maxLotCap) {
      maxLotClamped = true;
      warnings.push(`Risk-percentage volume (${rawVol.toFixed(2)}) capped by user Max Lot Cap (${settings.maxLotCap.toFixed(2)}).`);
    }

    const finalVolume = this.stepAndClamp(rawVol, minLot, maxLot, lotStep);

    return {
      finalVolume,
      rawCalculatedVolume: rawVol,
      cashRiskUSD,
      cashRiskAccountCurrency,
      lossPerLotUSD,
      slDistance,
      calculationMethod,
      marginClamped,
      maxLotClamped,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Calculates cash loss in USD for 1.00 standard lot based on Stop Loss distance
   */
  public calculateLossPerLotInUSD(symbol: string, entryPrice: number, slDistance: number): number {
    const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. Gold (XAUUSD / GOLD)
    if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) {
      // 1 standard lot = 100 troy oz. $1 price movement = $100 per lot.
      return slDistance * 100;
    }

    // 2. Silver (XAGUSD / SILVER)
    if (cleanSym.includes('XAG') || cleanSym.includes('SILVER')) {
      // 1 standard lot = 5,000 troy oz. $1 price movement = $5,000 per lot.
      return slDistance * 5000;
    }

    // 3. Crude Oil & Energy (USOIL / WTI, UKOIL / BRENT, XTIUSD, XBRUSD)
    if (cleanSym.includes('OIL') || cleanSym.includes('WTI') || cleanSym.includes('BRENT') || cleanSym.includes('XTI') || cleanSym.includes('XBR')) {
      // 1 standard lot = 1,000 barrels. $1 price movement = $1,000 per lot.
      return slDistance * 1000;
    }

    // 4. Natural Gas (XNGUSD / NATGAS)
    if (cleanSym.includes('GAS') || cleanSym.includes('XNG')) {
      // 1 standard lot = 10,000 MMBtu. $1 price movement = $10,000 per lot.
      return slDistance * 10000;
    }

    // 5. Cryptocurrencies (BTCUSD, ETHUSD, SOLUSD)
    if (cleanSym.includes('BTC') || cleanSym.includes('ETH') || cleanSym.includes('SOL') || cleanSym.includes('CRYPTO')) {
      // 1 lot = 1 coin. Loss = SL Distance in USD * 1.
      return slDistance * 1;
    }

    // 6. Equity Indices (US30 / DJ30, NAS100 / USTEC, SPX500, GER40 / DAX, UK100, JP225)
    if (cleanSym.includes('JP225') || cleanSym.includes('NIKKEI') || cleanSym.includes('JPN')) {
      // Nikkei index points are denominated in JPY
      const jpyToUSD = this.currencyService.toUSD(1.0, 'JPY');
      return slDistance * (jpyToUSD > 0 ? jpyToUSD : 0.0066);
    }

    if (
      cleanSym.includes('US30') ||
      cleanSym.includes('DJ30') ||
      cleanSym.includes('WALLSTREET') ||
      cleanSym.includes('NAS') ||
      cleanSym.includes('USTEC') ||
      cleanSym.includes('US100') ||
      cleanSym.includes('SPX') ||
      cleanSym.includes('US500') ||
      cleanSym.includes('GER') ||
      cleanSym.includes('DAX') ||
      cleanSym.includes('UK100') ||
      cleanSym.includes('FTSE') ||
      cleanSym.includes('CAC')
    ) {
      // Standard index CFD: 1 index point = $1 per 1.00 lot
      return slDistance * 1;
    }

    // 7. Forex Currency Pairs
    // Robustly extract 3-letter Base and Quote currencies (handles prefixes/suffixes like mEURUSD, EURUSD.pro, etc.)
    const forexCurrencies = 'EUR|USD|GBP|JPY|AUD|CAD|CHF|NZD|ZAR|SGD|MXN|TRY|SEK|NOK|PLN|CNH|HKD';
    const forexRegex = new RegExp(`(${forexCurrencies})(${forexCurrencies})`, 'i');
    const forexMatch = cleanSym.match(forexRegex);

    let base = '';
    let quote = '';
    if (forexMatch) {
      base = forexMatch[1].toUpperCase();
      quote = forexMatch[2].toUpperCase();
    } else if (cleanSym.length >= 6) {
      base = cleanSym.substring(0, 3);
      quote = cleanSym.substring(3, 6);
    }

    if (base && quote) {
      // Quote is USD (e.g. EURUSD, GBPUSD, AUDUSD, NZDUSD)
      if (quote === 'USD') {
        // 1 lot = 100,000 units. Loss in USD = slDistance * 100,000.
        return slDistance * 100000;
      }

      // Base is USD (e.g. USDJPY, USDCAD, USDCHF)
      if (base === 'USD') {
        // Loss in Quote = slDistance * 100,000.
        // Converted to USD = (slDistance * 100,000) / entryPrice.
        return entryPrice > 0 ? (slDistance * 100000) / entryPrice : slDistance * 100000;
      }

      // Cross pair without USD (e.g. EURGBP, GBPJPY, EURJPY, AUDCAD)
      // Loss in Quote = slDistance * 100,000.
      // Convert Quote to USD using CurrencyService
      const quoteToUSD = this.currencyService.toUSD(1.0, quote);
      if (quoteToUSD > 0) {
        return slDistance * 100000 * quoteToUSD;
      }
    }

    // Fallback standard calculation
    return entryPrice > 0 ? (slDistance / entryPrice) * 100000 : slDistance * 100000;
  }

  public getStandardContractSize(symbol: string): number {
    const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) return 100;
    if (cleanSym.includes('XAG') || cleanSym.includes('SILVER')) return 5000;
    if (cleanSym.includes('OIL') || cleanSym.includes('WTI') || cleanSym.includes('BRENT')) return 1000;
    if (cleanSym.includes('GAS') || cleanSym.includes('XNG')) return 10000;
    if (cleanSym.includes('BTC') || cleanSym.includes('ETH')) return 1;
    if (cleanSym.includes('US30') || cleanSym.includes('NAS')) return 1;
    return 100000; // Standard Forex
  }

  /**
   * Aligns volume to broker step and clamps within min and max with IEEE 754 precision protection
   */
  public stepAndClamp(vol: number, min: number, max: number, step: number): number {
    if (!vol || isNaN(vol) || vol <= 0) return min;

    const safeStep = step && step > 0 ? step : 0.01;
    let decimals = 2;
    if (safeStep >= 1.0) decimals = 0;
    else if (safeStep >= 0.1) decimals = 1;
    else if (safeStep >= 0.01) decimals = 2;
    else if (safeStep >= 0.001) decimals = 3;
    else decimals = 4;

    // Use epsilon (1e-7) to prevent floating-point floor truncation (e.g. 0.29 / 0.01 = 28.999999999999996)
    let stepped = Math.floor((vol + 1e-7) / safeStep) * safeStep;
    stepped = Number(stepped.toFixed(decimals));

    if (stepped < min) stepped = min;
    if (max > 0 && stepped > max) {
      stepped = Math.floor((max + 1e-7) / safeStep) * safeStep;
      stepped = Number(stepped.toFixed(decimals));
    }

    return stepped;
  }
}
