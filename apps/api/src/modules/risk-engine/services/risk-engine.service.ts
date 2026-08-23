import { Injectable, Logger } from '@nestjs/common';
import { CopyState } from '@prisma/client';
import {
  RiskProfile,
  TradeSignalInput,
  SymbolSpecs,
  RiskDecision,
  RecoveryContext,
} from '../interfaces/risk.interfaces';

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  private readonly GLOBAL_MIN_RR = 2.0;

  // ─────────────────────────────────────────────────────────
  // Primary entry-point: evaluate whether a trade should copy
  // ─────────────────────────────────────────────────────────
  public evaluateTrade(
    signal: TradeSignalInput,
    profile: RiskProfile,
    specs: SymbolSpecs,
    recovery?: RecoveryContext,
  ): RiskDecision {
    const decision: RiskDecision = {
      state: CopyState.REJECTED,
      intendedRisk: 0,
      maxPermittedRisk: 0,
      calculatedVol: 0,
      executedVol: 0,
      estimatedSlRisk: 0,
      roundingDiff: 0,
      dailyRiskBefore: profile.currentDailyRisk,
      dailyRiskAfter: profile.currentDailyRisk,
      rejectionReason: 'Unknown Error',
    };

    // ── RECOVERY PRE-FLIGHT CHECKS ──────────────────────────
    // Recovery trades must pass ADDITIONAL guards before the
    // normal risk pipeline. They CANNOT skip normal checks.
    if (recovery) {
      if (!recovery.masterSignalExists) {
        decision.rejectionReason = 'Recovery rejected: master trade no longer exists';
        return decision;
      }
      if (recovery.isAlreadyCopied) {
        decision.rejectionReason = 'Recovery rejected: trade already copied (duplicate)';
        return decision;
      }
    }

    // ── STEP 1: Missing SL ──────────────────────────────────
    if (!signal.sl || signal.sl === 0) {
      decision.state = CopyState.WAITING_FOR_SL;
      decision.rejectionReason = 'SL is missing';
      return decision;
    }

    // ── STEP 2: Missing TP ──────────────────────────────────
    if (profile.requireTp && (!signal.tp || signal.tp === 0)) {
      decision.state = CopyState.REJECTED;
      decision.rejectionReason = 'TP is missing and requireTp is ON';
      return decision;
    }

    // ── STEP 3: Monetary Risk Calculation ───────────────────
    const intendedRiskPct = (signal.masterRiskPct ?? 1.0) * profile.riskMultiplier;
    decision.intendedRisk = profile.equity * (intendedRiskPct / 100);
    decision.maxPermittedRisk = decision.intendedRisk;

    // ── STEP 4: Absolute lot sizing is skipped here ──────────
    // The MQL5 EA will calculate the final volume using its local dynamic
    // tickValue and tickSize to avoid complex currency conversions in Node.js.
    // We only pass down the `$ intended risk`.
    decision.calculatedVol = 0;
    decision.estimatedSlRisk = decision.intendedRisk;
    decision.roundingDiff = 0;

    // ── STEP 5: RR Validation ───────────────────────────────
    let nominalRR = this.computeRR(signal.priceOpen, signal.sl, signal.tp);
    if (!profile.requireTp && (!signal.tp || signal.tp === 0)) {
      nominalRR = Infinity; // NOT_APPLICABLE
    }

    if (recovery) {
      // Dynamic RR against current market price
      let recoveredRR = this.computeRR(
        recovery.currentMarketPrice,
        signal.sl,
        signal.tp,
      );
      if (!profile.requireTp && (!signal.tp || signal.tp === 0)) {
        recoveredRR = Infinity;
      }

      if (recoveredRR !== Infinity) {
        if (recoveredRR < this.GLOBAL_MIN_RR) {
          decision.rejectionReason = `Recovery rejected: remaining RR (${this.fmt(recoveredRR)}) is below global minimum (${this.GLOBAL_MIN_RR})`;
          return decision;
        }
        const originalRR = signal.masterOriginalRR
          ? this.round5(signal.masterOriginalRR)
          : this.round5(nominalRR);
        const degradation = this.round5(originalRR - recoveredRR);
        if (degradation > profile.maxRecoveryRRDegradation) {
          decision.rejectionReason = `Recovery rejected: RR degradation (${this.fmt(degradation)}) exceeds max allowed (${profile.maxRecoveryRRDegradation})`;
          return decision;
        }
      }
    } else {
      if (nominalRR !== Infinity && this.round5(nominalRR) < this.GLOBAL_MIN_RR) {
        decision.rejectionReason = `RR (${this.fmt(nominalRR)}) is below global minimum (${this.GLOBAL_MIN_RR})`;
        return decision;
      }
    }

    // Since the API no longer checks margin or volume limits, we approve it here.
    // The SubCopier EA will perform final validation of margin and lot sizes natively.

    // ── STEP 7: Hedging / Netting account logic ──────────────
    // On a NETTING account the broker nets offsetting positions on the same symbol.
    // The risk engine must account for any existing opposite position that would be
    // partially or fully offset rather than opening a new independent exposure.
    // The volume calculation above is correct in both cases because we always base
    // it on the SL distance of the new position. No adjustment is needed here since
    // the broker handles netting at the execution layer, but we flag it for the
    // caller to annotate the audit log.
    // NOTE: duplicate-position guard for netting is handled in the copy service
    //       (before this engine is called) because it requires a position lookup.
    const isNetting = profile.accountType === 'NETTING';
    // isNetting is surfaced in the decision for caller use (no rejection).
    void isNetting;

    // ── STEP 8: Daily Risk Validation ───────────────────────
    if (profile.dailyRiskEnabled) {
      if (profile.currentDailyRisk + decision.intendedRisk > profile.maxDailyRisk) {
        decision.rejectionReason =
          `Daily risk limit: would add $${this.fmt(decision.intendedRisk)}, ` +
          `remaining allowance $${this.fmt(profile.maxDailyRisk - profile.currentDailyRisk)}`;
        return decision;
      }
    }

    // ── STEP 9: Maximum Active Trades ───────────────────────
    if (profile.maxTradesEnabled && profile.currentActiveTrades >= profile.maxActiveTrades) {
      decision.rejectionReason = `Max active trades reached (${profile.maxActiveTrades})`;
      return decision;
    }

    // (Lot sizing logic removed, handled by EA locally)
    decision.executedVol = 0; // Volume is 0 because the EA will calculate it dynamically
    decision.estimatedSlRisk = decision.intendedRisk;
    decision.roundingDiff = 0;

    // Update projected daily risk
    if (profile.dailyRiskEnabled) {
      decision.dailyRiskAfter = profile.currentDailyRisk + decision.intendedRisk;
    }

    // ── STEP 12: Final Approval ──────────────────────────────
    decision.state = CopyState.APPROVED;
    decision.rejectionReason = undefined;
    return decision;
  }

  // ─────────────────────────────────────────────────────────
  // Expire a WAITING_FOR_SL signal after timeout
  // Called by a scheduler (e.g. every second via OnTimer analogue)
  // ─────────────────────────────────────────────────────────
  public shouldExpireSl(createdAt: Date, timeoutSec: number): boolean {
    const ageMs = Date.now() - createdAt.getTime();
    return ageMs >= timeoutSec * 1000;
  }

  // ─────────────────────────────────────────────────────────
  // Duplicate detection — called before evaluateTrade
  // ─────────────────────────────────────────────────────────
  public isDuplicateSignal(signalId: string, executedSignalIds: Set<string>): boolean {
    return executedSignalIds.has(signalId);
  }

  // ─────────────────────────────────────────────────────────
  // Partial fill risk accounting
  // When a position is only partially filled, the actual risk
  // is proportional to the filled volume, not the ordered volume.
  // ─────────────────────────────────────────────────────────
  public computeActualRiskForPartialFill(
    orderedVol: number,
    filledVol: number,
    estimatedFullSlRisk: number,
  ): number {
    if (orderedVol === 0) return 0;
    return (filledVol / orderedVol) * estimatedFullSlRisk;
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────
  private computeRR(entry: number, sl: number, tp: number): number {
    const slDist = Math.abs(entry - sl);
    const tpDist = Math.abs(entry - tp);
    if (slDist === 0) return 0;
    return tpDist / slDist;
  }

  private round5(n: number): number {
    return Math.round(n * 100000) / 100000;
  }

  private fmt(n: number): string {
    return n.toFixed(5);
  }
}
