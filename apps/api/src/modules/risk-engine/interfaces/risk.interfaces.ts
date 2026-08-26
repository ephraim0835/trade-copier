import { CopyState } from '@prisma/client';

export type AccountType = 'HEDGING' | 'NETTING';

export interface RiskProfile {
  equity: number;
  currency: string;
  marginFree: number;
  accountType: AccountType; // HEDGING or NETTING

  // From CopySettings
  riskPercentage: number;
  roundingTolerancePct: number;  // max ADDITIONAL risk from rounding, as % of intendedRisk
  dailyRiskEnabled: boolean;
  maxDailyRisk: number;
  maxTradesEnabled: boolean;
  maxActiveTrades: number;
  requireTp: boolean;
  missingSlTimeoutSec: number;
  maxRecoveryRRDegradation: number;

  // Current Account State
  currentDailyRisk: number;
  currentActiveTrades: number;
}

export interface TradeSignalInput {
  signalId: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
  volume: number;
  priceOpen: number;
  sl: number;
  tp: number;
  time: Date;

  // Master Trade context
  masterRiskPct?: number;        // Estimated risk % taken on the master
  masterMonetaryRisk?: number;
  masterOriginalRR?: number;     // Required for recovery RR degradation check
  
  // Partial fill context
  filledVolume?: number;         // Actual filled portion (for partial fills)
}

export interface SymbolSpecs {
  contractSize: number;
  tickSize: number;
  tickValue: number;    // value per tick per lot (in account currency)
  volumeStep: number;
  volumeMin: number;
  volumeMax: number;
  
  // For margin calculation
  marginRequiredPerLot?: number; // Margin required per standard lot
}

export interface RiskDecision {
  state: CopyState;

  intendedRisk: number;
  maxPermittedRisk: number;

  calculatedVol: number;
  executedVol: number;

  estimatedSlRisk: number;
  roundingDiff: number;       // Additional $ risk caused by rounding (positive = rounded up)

  dailyRiskBefore: number;
  dailyRiskAfter: number;

  rejectionReason?: string;
}

export interface RecoveryContext {
  currentMarketPrice: number;
  isAlreadyCopied: boolean;    // Pre-check: has this signal already been executed on this account?
  masterSignalExists: boolean; // Pre-check: does the master trade still exist?
}
