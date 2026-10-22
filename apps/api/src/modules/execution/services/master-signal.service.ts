import { Injectable, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterSignalDto, MasterModifyDto, MasterCloseDto, MasterTriggerDto } from '../dto/master-signal.dto';
import { PrismaService } from '../../../database/prisma.service';
import { RiskEngineService } from '../../risk-engine/services/risk-engine.service';
import { CurrencyService } from '../../risk-engine/services/currency.service';
import { LotCalculatorService, LotCalculationResult } from '../../risk-engine/services/lot-calculator.service';
import { HotDispatchService, HotCommandData } from './hot-dispatch.service';
import { AsyncPersistenceService } from './async-persistence.service';
import { CommandType, CommandStatus, CopyState, Mt5Account, CopySettings } from '@prisma/client';
import * as crypto from 'crypto';

interface CachedMasterAccount {
  id: string;
  currency: string;
  balance: number;
  initialBalance: number;
}

interface CachedSubAccount {
  id: string;
  userId?: string;
  botStopped?: boolean;
  subscriptionExpired?: boolean;
  isDemo: boolean;
  isActive: boolean;
  copySettings: CopySettings | null;
  equity: number;
  balance: number;
  initialBalance: number;
  freeMargin: number;
  currency: string;
}

interface InFlightTradeSignal {
  id: string;
  ticket: bigint;
  masterAcctId: string;
  symbol: string;
  type: string;
  volume: number;
  priceOpen: number;
  sl: number;
  tp: number;
  sequenceNumber: number;
  time: Date;
  copies: Map<string, InFlightTradeCopy>; // copyId -> InFlightTradeCopy
}

interface InFlightTradeCopy {
  id: string;
  signalId: string;
  subAccountId: string;
  state: CopyState;
  requestedVolume: number;
  executedVolume?: number;
  subOrderTicket?: bigint | null;
  subPositionId?: bigint | null;
  intendedRisk?: number | null;
  createdAt: Date;
}

@Injectable()
export class MasterSignalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MasterSignalService.name);
  private sweeperInterval: NodeJS.Timeout | null = null;
  private cacheRefreshInterval: NodeJS.Timeout | null = null;

  // In-memory Sub Accounts & CopySettings cache mapped by MasterAccountId (30s TTL with auto-refresh)
  private subAccountsCache = new Map<string, CachedSubAccount[]>();
  private masterAccountsCache = new Map<string, CachedMasterAccount>();
  private lastSubCacheRefresh = 0;

  // In-memory active signals and copy mappings keyed by composite `${masterAccountId}:${ticket}` (BUG-001)
  private readonly activeSignalsByTicket = new Map<string, InFlightTradeSignal>();

  public getSignalKey(masterAccountId: string, ticket: string | number | bigint): string {
    return `${masterAccountId}:${ticket.toString()}`;
  }

  private readonly demoOnly: boolean;
  private readonly lotCalculator: LotCalculatorService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
    private readonly currencyService: CurrencyService,
    private readonly hotDispatch: HotDispatchService,
    private readonly asyncPersistence: AsyncPersistenceService,
    private readonly configService: ConfigService,
    injectedLotCalculator?: LotCalculatorService,
  ) {
    this.demoOnly = this.configService?.get<string>('DEMO_ONLY') === 'true';
    this.lotCalculator = injectedLotCalculator || new LotCalculatorService(this.currencyService);
  }

  async onModuleInit() {
    await this.refreshSubAccountsCache();

    // Refresh accounts cache every 30 seconds
    this.cacheRefreshInterval = setInterval(() => {
      this.refreshSubAccountsCache().catch(err => {
        this.logger.warn(`Failed to refresh sub accounts cache: ${err.message}`);
      });
    }, 30000);

    // Run sweeper every 5 seconds to check for expired WAITING_FOR_SL trades in memory
    this.sweeperInterval = setInterval(() => this.sweepExpiredTrades(), 5000);
  }

  onModuleDestroy() {
    if (this.sweeperInterval) clearInterval(this.sweeperInterval);
    if (this.cacheRefreshInterval) clearInterval(this.cacheRefreshInterval);
  }

  private async refreshSubAccountsCache() {
    try {
      // 1. Self-healing: Ensure all active Master accounts are linked to active Sub accounts of the same user
      if (this.prisma?.mt5Account?.findMany && this.prisma?.accountSubscription?.upsert) {
        const activeMasters = await this.prisma.mt5Account.findMany({
          where: { role: 'MASTER', isActive: true },
          select: { id: true, userId: true },
        });

        const activeSubs = await this.prisma.mt5Account.findMany({
          where: { role: 'SUB', isActive: true, ...(this.demoOnly ? { isDemo: true } : {}) },
          include: { copySettings: true },
        });

        for (const master of activeMasters) {
          const userSubs = activeSubs.filter(s => s.userId === master.userId);
          for (const sub of userSubs) {
            await this.prisma.accountSubscription.upsert({
              where: {
                masterAccountId_subAccountId: {
                  masterAccountId: master.id,
                  subAccountId: sub.id,
                },
              },
              update: { isActive: true },
              create: {
                masterAccountId: master.id,
                subAccountId: sub.id,
                isActive: true,
                riskPercentage: sub.copySettings?.riskPercentage ?? 1.0,
              },
            });
          }
        }
      }

      // 2. Fetch all active subscriptions including subAccount and copySettings
      const subAccountFilter: any = { isActive: true };
      if (this.demoOnly) {
        subAccountFilter.isDemo = true;
      }
      const subscriptions = await this.prisma.accountSubscription.findMany({
        where: {
          isActive: true,
          subAccount: subAccountFilter,
        },
        include: {
          masterAccount: true,
          subAccount: {
            include: {
              copySettings: true,
              user: {
                select: {
                  botStopped: true,
                  subscription: true,
                },
              },
            },
          },
        },
      });

      const newCache = new Map<string, CachedSubAccount[]>();
      const newMasterCache = new Map<string, CachedMasterAccount>();
      
      for (const sub of subscriptions) {
        const m = sub.masterAccount;
        if (m) {
          newMasterCache.set(m.id, {
            id: m.id,
            currency: m.currency ?? 'USD',
            balance: m.balance ?? 10000,
            initialBalance: (m as any).initialBalance ?? m.balance ?? 10000,
          });
        }

        const a = sub.subAccount;
        const u = (a as any).user;
        const subRecord = u?.subscription;
        const now = Date.now();
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const isExpired = subRecord ? (
          subRecord.status === 'EXPIRED' ||
          subRecord.status === 'CANCELED' ||
          subRecord.status === 'PAST_DUE' ||
          (subRecord.status === 'TRIAL' && subRecord.currentPeriodEnd && new Date(subRecord.currentPeriodEnd).getTime() < now) ||
          (subRecord.status === 'ACTIVE' && subRecord.currentPeriodEnd && new Date(subRecord.currentPeriodEnd).getTime() + THREE_DAYS_MS < now)
        ) : false;
        
        // Ensure copySettings is never null so trades are never skipped
        const baseSettings: any = a.copySettings || {
          id: 'default',
          mt5AccountId: a.id,
          riskType: 'RISK_PERCENT',
          fixedLotSize: 0.01,
          lotMultiplier: 1.0,
          riskPercentage: 1.0,
          roundingTolerancePct: 2.0,
          dailyRiskEnabled: false,
          maxDailyRisk: 0,
          maxTradesEnabled: false,
          maxActiveTrades: 0,
          requireTp: false,
          missingSlTimeoutSec: 60,
          maxRecoveryRRDegradation: 0.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mergedSettings = { ...baseSettings };
        if (sub.riskPercentage !== null && sub.riskPercentage !== undefined) {
          mergedSettings.riskPercentage = sub.riskPercentage;
        }

        const cached: CachedSubAccount = {
          id: a.id,
          userId: a.userId,
          botStopped: u?.botStopped || false,
          subscriptionExpired: isExpired,
          isDemo: a.isDemo,
          isActive: a.isActive,
          copySettings: mergedSettings,
          equity: a.equity ?? 0,
          balance: a.balance ?? 0,
          initialBalance: (a as any).initialBalance ?? a.balance ?? a.equity ?? 0,
          freeMargin: a.freeMargin ?? 0,
          currency: a.currency ?? 'USD',
        };

        if (!newCache.has(sub.masterAccountId)) {
          newCache.set(sub.masterAccountId, []);
        }
        newCache.get(sub.masterAccountId)!.push(cached);
      }

      this.subAccountsCache = newCache;
      this.masterAccountsCache = newMasterCache;
      this.lastSubCacheRefresh = Date.now();
      
      let totalSubs = 0;
      for (const subs of newCache.values()) totalSubs += subs.length;
      this.logger.log(`[MasterSignal] Sub accounts cache updated: ${totalSubs} active subscriptions mapped`);
      for (const [masterId, subs] of newCache.entries()) {
        this.logger.log(`[MasterSignal] Master ${masterId} -> sub accounts: [${subs.map(s => s.id).join(', ')}]`);
      }
    } catch (err: any) {
      this.logger.warn(`[MasterSignal] DB error refreshing sub accounts: ${err.message}. Using existing cache.`);
    }
  }

  private sweepExpiredTrades() {
    const now = Date.now();
    for (const signal of this.activeSignalsByTicket.values()) {
      for (const copy of signal.copies.values()) {
        if (copy.state === CopyState.WAITING_FOR_SL) {
          let sub: CachedSubAccount | undefined;
          for (const subs of this.subAccountsCache.values()) {
            sub = subs.find(s => s.id === copy.subAccountId);
            if (sub) break;
          }
          const timeoutSec = sub?.copySettings?.missingSlTimeoutSec ?? 60;
          if (now - copy.createdAt.getTime() > timeoutSec * 1000) {
            copy.state = CopyState.EXPIRED;
            this.logger.log(`Sweeper expired WAITING_FOR_SL copy ${copy.id}`);
          }
        }
      }
    }
  }

  private getMockSymbolSpecs(symbol: string) {
    const specs = {
      contractSize: 100000,
      tickSize: 0.00001,
      tickValue: 1.0,
      volumeStep: 0.01,
      volumeMin: 0.01,
      volumeMax: 100.0,
      marginRequiredPerLot: 1000,
    };
    if (symbol.includes('BTC')) {
      specs.tickSize = 0.01;
      specs.tickValue = 0.01;
      specs.volumeStep = 0.01;
      specs.volumeMin = 0.01;
      specs.marginRequiredPerLot = 50;
    }
    return specs;
  }

  private buildRiskProfile(sub: CachedSubAccount, master?: CachedMasterAccount) {
    const copySettings = sub.copySettings || ({} as any);

    let activeTradesCount = 0;
    let dailyRiskSum = 0;
    const startOfTodayMs = new Date().setUTCHours(0, 0, 0, 0);

    for (const signal of this.activeSignalsByTicket.values()) {
      for (const copy of signal.copies.values()) {
        if (copy.subAccountId === sub.id) {
          const isActive =
            copy.state === CopyState.APPROVED ||
            copy.state === CopyState.WAITING_FOR_SL ||
            copy.state === CopyState.RECOVERING;
          if (isActive) {
            activeTradesCount++;
            if (copy.createdAt.getTime() >= startOfTodayMs) {
              dailyRiskSum += copy.intendedRisk || 0;
            }
          }
        }
      }
    }

    return {
      equity: sub.equity > 0 ? sub.equity : 10000,
      balance: sub.balance > 0 ? sub.balance : 10000,
      initialBalance: sub.initialBalance > 0 ? sub.initialBalance : (sub.balance > 0 ? sub.balance : (sub.equity > 0 ? sub.equity : 10000)),
      currency: sub.currency,
      marginFree: sub.freeMargin > 0 ? sub.freeMargin : 10000,
      accountType: 'HEDGING' as const,
      masterInitialBalance: master?.initialBalance,
      masterCurrency: master?.currency,
      riskPercentage: copySettings.riskPercentage ?? 1.0,
      riskType: copySettings.riskType ?? 'RISK_PERCENT',
      maxLotCap: copySettings.maxLotCap ?? null,
      roundingTolerancePct: copySettings.roundingTolerancePct ?? 2.0,
      dailyRiskEnabled: copySettings.dailyRiskEnabled ?? false,
      maxDailyRisk: copySettings.maxDailyRisk ?? 0,
      maxTradesEnabled: copySettings.maxTradesEnabled ?? false,
      maxActiveTrades: copySettings.maxActiveTrades ?? 0,
      requireTp: copySettings.requireTp ?? false,
      missingSlTimeoutSec: copySettings.missingSlTimeoutSec ?? 60,
      maxRecoveryRRDegradation: copySettings.maxRecoveryRRDegradation ?? 0.5,
      currentDailyRisk: dailyRiskSum,
      currentActiveTrades: activeTradesCount,
    };
  }

  private calculateMasterTelemetry(dto: any, backendReceivedAt: number) {
    if (!dto.masterEventDetectedAt || !dto.masterEventQueuedAt || !dto.masterEventSentAt) {
      return { detected: null, queued: null, sent: null };
    }
    const networkLatencyMs = 1;
    const sentAtMs = backendReceivedAt - networkLatencyMs;
    const queueWaitMs = (dto.masterEventSentAt - dto.masterEventQueuedAt) / 1000;
    const detectWaitMs = (dto.masterEventQueuedAt - dto.masterEventDetectedAt) / 1000;

    const queuedAtMs = sentAtMs - queueWaitMs;
    const detectedAtMs = queuedAtMs - detectWaitMs;

    return {
      detected: new Date(detectedAtMs),
      queued: new Date(queuedAtMs),
      sent: new Date(sentAtMs),
    };
  }

  /**
   * Evaluates trade volume based on the 4 Risk Multipliers:
   * 1. RISK_PERCENT: Calculated from Stop Loss distance with multi-currency conversion
   * 2. FIXED_LOT: Flat specified volume
   * 3. BALANCE_MULTIPLIER: Scaled proportionally to balance ratio with multiplier
   * 4. EQUITY_MULTIPLIER: Scaled proportionally to floating equity ratio with multiplier
   */
  public computeSubVolumeDetails(
    sub: CachedSubAccount,
    masterInfo: CachedMasterAccount | undefined,
    masterVolume: number,
    symbol: string,
    orderType: string,
    priceOpen: number,
    sl: number,
  ): LotCalculationResult {
    const copySettings: any = sub.copySettings || {};
    const result = this.lotCalculator.calculateLotSize(
      {
        balance: sub.balance,
        equity: sub.equity,
        freeMargin: sub.freeMargin,
        currency: sub.currency,
      },
      masterInfo ? {
        balance: masterInfo.balance,
        equity: (masterInfo as any).equity,
        currency: masterInfo.currency,
      } : undefined,
      {
        riskType: copySettings.riskType,
        riskPercentage: copySettings.riskPercentage,
        fixedLotSize: copySettings.fixedLotSize,
        lotMultiplier: copySettings.lotMultiplier,
        maxLotCap: copySettings.maxLotCap,
      },
      {
        symbol,
        orderType,
        masterVolume,
        entryPrice: priceOpen,
        stopLoss: sl,
      }
    );

    if (result.warnings && result.warnings.length > 0) {
      this.logger.debug(`[LotCalc] ${symbol} for sub ${sub.id}: ${result.warnings.join('; ')} -> Result: ${result.finalVolume} lots`);
    }

    return result;
  }

  public computeSubVolume(
    sub: CachedSubAccount,
    masterInfo: CachedMasterAccount | undefined,
    masterVolume: number,
    symbol: string,
    orderType: string,
    priceOpen: number,
    sl: number,
  ): number {
    return this.computeSubVolumeDetails(sub, masterInfo, masterVolume, symbol, orderType, priceOpen, sl).finalVolume;
  }

  /**
   * HOT PATH: processOpen
   * 0 synchronous Supabase queries. In-memory risk evaluation -> HotDispatchService -> Async persistence.
   */
  async processOpen(masterAccountId: string, dto: MasterSignalDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing OPEN for master: ${masterAccountId}, ticket: ${dto.ticket}, seq: ${dto.sequenceNumber}`);

    // 1. In-memory Idempotency and sequence duplicate check (BUG-002)
    const seq = dto.sequenceNumber || 1;
    if (this.hotDispatch.isDuplicateOrProcessed(masterAccountId, dto.ticket, seq, dto.eventId)) {
      this.logger.log(`Signal ${dto.ticket} already processed (seq: ${seq}, eventId: ${dto.eventId}). Idempotent return.`);
      return { success: true, duplicate: true, message: 'Already processed' };
    }
    this.hotDispatch.updateSequence(masterAccountId, dto.ticket, seq);

    const now = new Date();
    const signalId = crypto.randomUUID();
    const signalTicket = BigInt(dto.ticket);
    const telemetry = this.calculateMasterTelemetry(dto, backendReceivedAt);
    const tRiskStart = Date.now();

    const inFlightSignal: InFlightTradeSignal = {
      id: signalId,
      ticket: signalTicket,
      masterAcctId: masterAccountId,
      symbol: dto.symbol,
      type: dto.type,
      volume: dto.volume,
      priceOpen: dto.priceOpen,
      sl: dto.sl ?? 0,
      tp: dto.tp ?? 0,
      sequenceNumber: dto.sequenceNumber || 1,
      time: now,
      copies: new Map(),
    };

    const symbolSpecs = this.getMockSymbolSpecs(dto.symbol);
    const tradeCopiesData: any[] = [];
    const executionCommandsData: HotCommandData[] = [];

    // 3. Authoritative Risk Engine evaluation in-memory for subscribed active Demo sub-accounts
    const subscribedSubs = this.subAccountsCache.get(masterAccountId) || [];
    const masterInfo = this.masterAccountsCache.get(masterAccountId);
    const masterCurrency = masterInfo?.currency || 'USD';
    const masterInitial = masterInfo?.initialBalance || masterInfo?.balance || 10000;
    const masterRiskPct = 1.0;
    const masterCapitalUSD = this.currencyService.toUSD(masterInitial, masterCurrency);

    for (const sub of subscribedSubs) {
      if (!sub.copySettings || !sub.isActive) continue;
      if (this.demoOnly && !sub.isDemo) continue;
      if (sub.botStopped) {
        this.logger.log(`[MasterSignal] Skipping sub ${sub.id}: Bot copying stopped by user`);
        continue;
      }
      if (sub.subscriptionExpired) {
        this.logger.warn(`[MasterSignal] Skipping sub ${sub.id}: Subscription expired or past due`);
        continue;
      }

      const riskProfile = this.buildRiskProfile(sub, masterInfo);
      const signalInput = {
        signalId,
        symbol: dto.symbol,
        type: dto.type,
        volume: dto.volume,
        priceOpen: dto.priceOpen,
        sl: dto.sl ?? 0,
        tp: dto.tp ?? 0,
        time: now,
        masterRiskPct,
      };

      const decision = this.riskEngine.evaluateTrade(signalInput, riskProfile, symbolSpecs);
      
      // Authoritative multi-currency and Stop Loss volume calculation across all 4 modes
      const lotCalcResult = this.computeSubVolumeDetails(
        sub,
        masterInfo,
        dto.volume,
        dto.symbol,
        dto.type,
        dto.priceOpen || 0,
        dto.sl ?? 0
      );

      const calculatedVolume = lotCalcResult.finalVolume;
      const finalVolume = (decision.executedVol && decision.executedVol > 0) ? decision.executedVol : calculatedVolume;
      const isRiskPercent = (sub.copySettings?.riskType || 'RISK_PERCENT').toUpperCase() === 'RISK_PERCENT';
      const intendedRisk = (isRiskPercent && lotCalcResult.cashRiskAccountCurrency > 0) ? lotCalcResult.cashRiskAccountCurrency : 0;
      const maxLotCap = sub.copySettings?.maxLotCap ?? null;

      const tradeCopyId = crypto.randomUUID();

      const inFlightCopy: InFlightTradeCopy = {
        id: tradeCopyId,
        signalId,
        subAccountId: sub.id,
        state: decision.state,
        requestedVolume: finalVolume,
        intendedRisk: intendedRisk || 0,
        createdAt: now,
      };
      inFlightSignal.copies.set(tradeCopyId, inFlightCopy);

      tradeCopiesData.push({
        id: tradeCopyId,
        signalId,
        subAccountId: sub.id,
        state: decision.state,
        requestedVolume: finalVolume,
      });

      if (decision.state === CopyState.APPROVED) {
        const commandId = `cmd-open-${tradeCopyId}-${dto.sequenceNumber || Date.now()}`;
        const riskCompletedAt = new Date();

        const hotCmd: HotCommandData = {
          id: commandId,
          eventId: dto.eventId,
          tradeCopyId,
          subAccountId: sub.id,
          masterAccountId,
          type: CommandType.OPEN_ORDER,
          status: CommandStatus.CREATED,
          symbol: dto.symbol,
          orderType: dto.type,
          volume: finalVolume,
          intendedRisk,
          maxLotCap,
          price: dto.priceOpen || 0,
          sl: dto.sl ?? 0,
          tp: dto.tp ?? 0,
          sequenceNumber: dto.sequenceNumber || 1,
          expiresAt: new Date(Date.now() + 5 * 60000), // 5m expiry
          masterSignalId: signalId,
          masterOrderTicket: signalTicket,
          masterPositionTicket: signalTicket,
          subPositionTicket: null,
          subOrderTicket: null,
          masterEventDetectedAt: telemetry.detected,
          masterEventQueuedAt: telemetry.queued,
          masterEventSentAt: telemetry.sent,
          backendReceivedAt: new Date(backendReceivedAt),
          riskDecisionCompletedAt: riskCompletedAt,
          hotPathCommandAvailableAt: new Date(),
          createdAt: now,
          updatedAt: now,
        };

        // 4. Enqueue into HotDispatchService
        await this.hotDispatch.enqueueCommand(hotCmd);
        executionCommandsData.push(hotCmd);
      } else if (decision.state === CopyState.WAITING_FOR_SL) {
        const timeoutSec = sub.copySettings?.missingSlTimeoutSec || 60;
        this.logger.log(`[HOTPATH] Copy ${tradeCopyId} for sub ${sub.id} is WAITING_FOR_SL (Timer: ${timeoutSec}s)`);

        // Automatically expire if Master does not provide SL within timeoutSec
        const signalKey = this.getSignalKey(masterAccountId, dto.ticket);
        setTimeout(() => {
          const currentSignal = this.activeSignalsByTicket.get(signalKey);
          const currentCopy = currentSignal?.copies.get(tradeCopyId);
          if (currentCopy && currentCopy.state === CopyState.WAITING_FOR_SL) {
            currentCopy.state = CopyState.REJECTED;
            this.logger.warn(`[HOTPATH] Copy ${tradeCopyId} timed out after ${timeoutSec}s waiting for Master SL. Marked REJECTED.`);
            this.asyncPersistence.enqueueTask('UPDATE_COPY_REJECTED', {
              tradeCopyId,
              rejectionReason: `Expired: Master did not set Stop Loss within ${timeoutSec}s`,
            });
          }
        }, timeoutSec * 1000);
      }
    }

    // Register active signal in memory with composite key (BUG-001)
    const signalKey = this.getSignalKey(masterAccountId, dto.ticket);
    this.activeSignalsByTicket.set(signalKey, inFlightSignal);

    // 5. Asynchronous persistence to Supabase
    const signalData = {
      id: signalId,
      ticket: signalTicket,
      masterAcctId: masterAccountId,
      symbol: dto.symbol,
      type: dto.type,
      volume: dto.volume,
      priceOpen: dto.priceOpen,
      sl: dto.sl ?? 0,
      tp: dto.tp ?? 0,
      sequenceNumber: dto.sequenceNumber,
      time: now,
    };

    this.asyncPersistence.enqueueTask('PERSIST_SIGNAL_AND_COMMANDS', {
      signalData,
      tradeCopies: tradeCopiesData,
      executionCommands: executionCommandsData,
    });

    this.logger.debug(`[HOTPATH] OPEN processed in ${Date.now() - backendReceivedAt}ms, ${executionCommandsData.length} commands enqueued.`);
    return { success: true, message: 'OPEN processed' };
  }

  /**
   * HOT PATH: processModify
   * Evaluates WAITING_FOR_SL transitions or generates MODIFY_ORDER commands without synchronous DB queries.
   */
  async processModify(masterAccountId: string, dto: MasterModifyDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing MODIFY for master: ${masterAccountId}, ticket: ${dto.ticket}, seq: ${dto.sequenceNumber}`);

    // Idempotency / duplicate sequence check (BUG-002)
    if (this.hotDispatch.isDuplicateOrProcessed(masterAccountId, dto.ticket, dto.sequenceNumber, dto.eventId)) {
      this.logger.log(`Modify ${dto.ticket} already processed (seq: ${dto.sequenceNumber}, eventId: ${dto.eventId}). Idempotent return.`);
      return { success: true, duplicate: true, message: 'Event already processed' };
    }
    this.hotDispatch.updateSequence(masterAccountId, dto.ticket, dto.sequenceNumber);

    const signalKey = this.getSignalKey(masterAccountId, dto.ticket);
    const signal = this.activeSignalsByTicket.get(signalKey);
    if (!signal) {
      this.logger.warn(`Active signal ${dto.ticket} not in memory. Querying DB fallback asynchronously.`);
    }

    const now = new Date();
    const telemetry = this.calculateMasterTelemetry(dto, backendReceivedAt);
    const executionCommandsData: HotCommandData[] = [];

    if (signal) {
      signal.sl = dto.sl ?? signal.sl;
      signal.tp = dto.tp ?? signal.tp;
      signal.priceOpen = dto.priceOpen ?? signal.priceOpen;
      signal.sequenceNumber = dto.sequenceNumber;

      for (const copy of signal.copies.values()) {
        // Case 1: Transition WAITING_FOR_SL -> APPROVED
        if (copy.state === CopyState.WAITING_FOR_SL && dto.sl && dto.sl > 0) {
          const subscribedSubs = this.subAccountsCache.get(masterAccountId) || [];
          const sub = subscribedSubs.find(s => s.id === copy.subAccountId);
          if (!sub?.copySettings) continue;

          const specs = this.getMockSymbolSpecs(signal.symbol);
          const profile = this.buildRiskProfile(sub);
          const signalInput = {
            signalId: signal.id,
            symbol: signal.symbol,
            type: signal.type as any,
            volume: signal.volume,
            priceOpen: signal.priceOpen,
            sl: dto.sl,
            tp: dto.tp ?? signal.tp,
            time: now,
            masterRiskPct: 1.0,
          };

          const decision = this.riskEngine.evaluateTrade(signalInput, profile, specs);
          if (decision.state === CopyState.APPROVED) {
            const masterInfo = this.masterAccountsCache.get(masterAccountId);
            const lotCalcResult = this.computeSubVolumeDetails(
              sub,
              masterInfo,
              signal.volume,
              signal.symbol,
              signal.type,
              signal.priceOpen,
              dto.sl
            );
            const computedVol = lotCalcResult.finalVolume;
            const finalVol = (decision.executedVol && decision.executedVol > 0) ? decision.executedVol : computedVol;
            const isRiskPercent = (sub.copySettings?.riskType || 'RISK_PERCENT').toUpperCase() === 'RISK_PERCENT';
            const intendedRisk = (isRiskPercent && lotCalcResult.cashRiskAccountCurrency > 0) ? lotCalcResult.cashRiskAccountCurrency : 0;
            const maxLotCap = sub.copySettings?.maxLotCap ?? null;

            copy.state = CopyState.APPROVED;
            copy.requestedVolume = finalVol;

            const commandId = `cmd-open-${copy.id}-${dto.sequenceNumber}`;
            const hotCmd: HotCommandData = {
              id: commandId,
              eventId: dto.eventId,
              tradeCopyId: copy.id,
              subAccountId: copy.subAccountId,
              masterAccountId,
              type: CommandType.OPEN_ORDER,
              status: CommandStatus.CREATED,
              symbol: signal.symbol,
              orderType: signal.type as any,
              volume: finalVol,
              intendedRisk,
              maxLotCap,
              price: 0,
              sl: dto.sl,
              tp: dto.tp ?? signal.tp,
              sequenceNumber: dto.sequenceNumber,
              expiresAt: new Date(Date.now() + 5 * 60000),
              masterSignalId: signal.id,
              masterOrderTicket: signal.ticket,
              masterPositionTicket: signal.ticket,
              subPositionTicket: null,
              subOrderTicket: null,
              masterEventDetectedAt: telemetry.detected,
              masterEventQueuedAt: telemetry.queued,
              masterEventSentAt: telemetry.sent,
              backendReceivedAt: new Date(backendReceivedAt),
              riskDecisionCompletedAt: new Date(),
              hotPathCommandAvailableAt: new Date(),
              createdAt: now,
              updatedAt: now,
            };

            await this.hotDispatch.enqueueCommand(hotCmd);
            executionCommandsData.push(hotCmd);
            copy.state = CopyState.APPROVED;
            this.logger.log(`[HOTPATH] WAITING_FOR_SL copy ${copy.id} transitioned to APPROVED, OPEN_ORDER enqueued.`);
          }
          continue;
        }

        // Case 2: Modify existing position or pending order
        let targetSubPositionTicket = copy.subPositionId ?? copy.subOrderTicket;
        if (!targetSubPositionTicket) {
          const allCmds = this.hotDispatch.getAllCommands();
          const openCmd = allCmds.find((c: HotCommandData) => c.tradeCopyId === copy.id && c.type === CommandType.OPEN_ORDER && c.orderTicket);
          if (openCmd?.orderTicket) {
            targetSubPositionTicket = openCmd.orderTicket;
            copy.subPositionId = openCmd.orderTicket;
          }
        }

        const commandId = `cmd-mod-${copy.id}-${dto.sequenceNumber}`;
        const hotCmd: HotCommandData = {
          id: commandId,
          eventId: dto.eventId,
          tradeCopyId: copy.id,
          subAccountId: copy.subAccountId,
          masterAccountId,
          type: CommandType.MODIFY_ORDER,
          status: CommandStatus.CREATED,
          symbol: signal.symbol,
          orderType: signal.type as any,
          volume: copy.executedVolume || copy.requestedVolume || signal.volume,
          price: dto.priceOpen ?? signal.priceOpen,
          sl: dto.sl !== undefined ? dto.sl : signal.sl,
          tp: dto.tp !== undefined ? dto.tp : signal.tp,
          sequenceNumber: dto.sequenceNumber,
          expiresAt: new Date(Date.now() + 5 * 60000),
          masterSignalId: signal.id,
          masterOrderTicket: signal.ticket,
          masterPositionTicket: signal.ticket,
          subPositionTicket: targetSubPositionTicket,
          subOrderTicket: copy.subOrderTicket ?? targetSubPositionTicket,
          masterEventDetectedAt: telemetry.detected,
          masterEventQueuedAt: telemetry.queued,
          masterEventSentAt: telemetry.sent,
          backendReceivedAt: new Date(backendReceivedAt),
          riskDecisionCompletedAt: new Date(),
          hotPathCommandAvailableAt: new Date(),
          createdAt: now,
          updatedAt: now,
        };

        await this.hotDispatch.enqueueCommand(hotCmd);
        executionCommandsData.push(hotCmd);
        this.logger.log(`[HOTPATH] Enqueued MODIFY command ${commandId} for sub ${copy.subAccountId}, posTicket: ${targetSubPositionTicket}, sl: ${dto.sl}, tp: ${dto.tp}`);
      }
    } else {
      this.logger.warn(`[HOTPATH] Signal ${dto.ticket} not found in RAM for MODIFY. Querying DB fallback asynchronously.`);
      this.prisma.tradeSignal.findFirst({
        where: { masterAcctId: masterAccountId, ticket: BigInt(dto.ticket) },
        include: { copies: true },
      }).then(async (dbSignal) => {
        if (dbSignal) {
          for (const copy of dbSignal.copies) {
            let targetPos = copy.subPositionId ?? copy.subOrderTicket;
            if (!targetPos) {
              const openCmd = await this.prisma.executionCommand.findFirst({
                where: { tradeCopyId: copy.id, type: CommandType.OPEN_ORDER, orderTicket: { not: null } },
              });
              if (openCmd?.orderTicket) {
                targetPos = openCmd.orderTicket;
              }
            }
            const commandId = `cmd-mod-${copy.id}-${dto.sequenceNumber}`;
            const hotCmd: HotCommandData = {
              id: commandId,
              eventId: dto.eventId,
              tradeCopyId: copy.id,
              subAccountId: copy.subAccountId,
              masterAccountId,
              type: CommandType.MODIFY_ORDER,
              status: CommandStatus.CREATED,
              symbol: dbSignal.symbol,
              orderType: dbSignal.type as any,
              volume: copy.executedVolume ?? copy.requestedVolume ?? dbSignal.volume,
              price: dto.priceOpen ?? dbSignal.priceOpen,
              sl: dto.sl !== undefined ? dto.sl : dbSignal.sl,
              tp: dto.tp !== undefined ? dto.tp : dbSignal.tp,
              sequenceNumber: dto.sequenceNumber,
              expiresAt: new Date(Date.now() + 5 * 60000),
              masterSignalId: dbSignal.id,
              masterPositionTicket: dbSignal.ticket,
              subPositionTicket: targetPos,
              subOrderTicket: copy.subOrderTicket ?? targetPos,
              backendReceivedAt: new Date(backendReceivedAt),
              hotPathCommandAvailableAt: new Date(),
              createdAt: now,
              updatedAt: now,
            };
            await this.hotDispatch.enqueueCommand(hotCmd);
            this.logger.log(`[HOTPATH] Fallback: Enqueued MODIFY command ${commandId} for sub ${copy.subAccountId}`);
          }
        }
      }).catch(err => this.logger.error(`Error querying fallback trade signal for modify: ${err.message}`));
    }

    // Async persistence
    this.asyncPersistence.enqueueTask('UPDATE_SIGNAL_MODIFY', {
      signalId: signal?.id,
      sl: dto.sl,
      tp: dto.tp,
      priceOpen: dto.priceOpen,
      sequenceNumber: dto.sequenceNumber,
      executionCommands: executionCommandsData,
    });

    return { success: true, message: 'MODIFY processed' };
  }

  /**
   * HOT PATH: processClose
   */
  async processClose(masterAccountId: string, dto: MasterCloseDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing CLOSE for master: ${masterAccountId}, ticket: ${dto.ticket}, vol: ${dto.volume}`);

    // Idempotency / duplicate sequence check (BUG-002)
    if (this.hotDispatch.isDuplicateOrProcessed(masterAccountId, dto.ticket, dto.sequenceNumber, dto.eventId)) {
      this.logger.log(`Close ${dto.ticket} already processed (seq: ${dto.sequenceNumber}, eventId: ${dto.eventId}). Idempotent return.`);
      return { success: true, duplicate: true, message: 'Event already processed' };
    }
    this.hotDispatch.updateSequence(masterAccountId, dto.ticket, dto.sequenceNumber);

    const signalKey = this.getSignalKey(masterAccountId, dto.ticket);
    const signal = this.activeSignalsByTicket.get(signalKey);
    const now = new Date();
    const telemetry = this.calculateMasterTelemetry(dto, backendReceivedAt);
    const executionCommandsData: HotCommandData[] = [];

    if (signal) {
      const isPartial = dto.volume !== undefined && dto.volume < signal.volume;
      const cmdType = isPartial ? CommandType.CLOSE_PARTIAL : CommandType.CLOSE_ORDER;
      const closeFraction = isPartial ? (dto.volume! / signal.volume) : 1.0;

      for (const copy of signal.copies.values()) {
        const isPending = !copy.subPositionId && copy.subOrderTicket;
        let currentVol = copy.executedVolume ?? copy.requestedVolume ?? signal.volume;
        if (currentVol <= 0) currentVol = signal.volume;

        let requestedCloseVol = currentVol * closeFraction;
        if (isPending) {
          requestedCloseVol = copy.requestedVolume || signal.volume;
        } else {
          requestedCloseVol = this.lotCalculator.stepAndClamp(requestedCloseVol, 0.01, currentVol, 0.01);
        }
        const effectiveCmdType = (!isPending && requestedCloseVol >= currentVol) ? CommandType.CLOSE_ORDER : (isPending ? CommandType.CLOSE_ORDER : cmdType);

        // Ensure subPositionTicket is populated
        let targetSubPositionTicket = copy.subPositionId ?? copy.subOrderTicket;
        if (!targetSubPositionTicket) {
          // Check if any open command in hot dispatch holds the executed orderTicket
          const allCmds = this.hotDispatch.getAllCommands();
          const openCmd = allCmds.find((c: HotCommandData) => c.tradeCopyId === copy.id && c.type === CommandType.OPEN_ORDER && c.orderTicket);
          if (openCmd?.orderTicket) {
            targetSubPositionTicket = openCmd.orderTicket;
            copy.subPositionId = openCmd.orderTicket;
          }
        }

        const commandId = `cmd-close-${copy.id}-${dto.sequenceNumber}`;
        const hotCmd: HotCommandData = {
          id: commandId,
          eventId: dto.eventId,
          tradeCopyId: copy.id,
          subAccountId: copy.subAccountId,
          masterAccountId,
          type: effectiveCmdType,
          status: CommandStatus.CREATED,
          symbol: signal.symbol,
          orderType: signal.type as any,
          volume: requestedCloseVol,
          sequenceNumber: dto.sequenceNumber,
          expiresAt: new Date(Date.now() + 5 * 60000),
          masterSignalId: signal.id,
          masterPositionTicket: signal.ticket,
          subPositionTicket: targetSubPositionTicket,
          subOrderTicket: copy.subOrderTicket ?? targetSubPositionTicket,
          masterEventDetectedAt: telemetry.detected,
          masterEventQueuedAt: telemetry.queued,
          masterEventSentAt: telemetry.sent,
          backendReceivedAt: new Date(backendReceivedAt),
          riskDecisionCompletedAt: new Date(),
          hotPathCommandAvailableAt: new Date(),
          createdAt: now,
          updatedAt: now,
        };

        await this.hotDispatch.enqueueCommand(hotCmd);
        executionCommandsData.push(hotCmd);
        this.logger.log(`[HOTPATH] Enqueued CLOSE command ${commandId} for sub ${copy.subAccountId}, posTicket: ${targetSubPositionTicket}, vol: ${requestedCloseVol}`);
      }
    } else {
      this.logger.warn(`[HOTPATH] Signal ${dto.ticket} not found in active RAM cache. Finding trade copies in persistent store.`);
      // Async fallback to find trade copies from DB if active signal cache was evicted/restarted
      this.prisma.tradeSignal.findFirst({
        where: { masterAcctId: masterAccountId, ticket: BigInt(dto.ticket) },
        include: { copies: true },
      }).then(async (dbSignal) => {
        if (dbSignal) {
          for (const copy of dbSignal.copies) {
            let targetPos = copy.subPositionId ?? copy.subOrderTicket;
            if (!targetPos) {
              const openCmd = await this.prisma.executionCommand.findFirst({
                where: { tradeCopyId: copy.id, type: CommandType.OPEN_ORDER, orderTicket: { not: null } },
              });
              if (openCmd?.orderTicket) {
                targetPos = openCmd.orderTicket;
              }
            }
            const commandId = `cmd-close-${copy.id}-${dto.sequenceNumber}`;
            const hotCmd: HotCommandData = {
              id: commandId,
              eventId: dto.eventId,
              tradeCopyId: copy.id,
              subAccountId: copy.subAccountId,
              masterAccountId,
              type: CommandType.CLOSE_ORDER,
              status: CommandStatus.CREATED,
              symbol: dbSignal.symbol,
              orderType: dbSignal.type as any,
              volume: copy.executedVolume ?? copy.requestedVolume ?? dbSignal.volume,
              sequenceNumber: dto.sequenceNumber,
              expiresAt: new Date(Date.now() + 5 * 60000),
              masterSignalId: dbSignal.id,
              masterPositionTicket: dbSignal.ticket,
              subPositionTicket: targetPos,
              subOrderTicket: copy.subOrderTicket,
              backendReceivedAt: new Date(backendReceivedAt),
              hotPathCommandAvailableAt: new Date(),
              createdAt: now,
              updatedAt: now,
            };
            await this.hotDispatch.enqueueCommand(hotCmd);
            this.logger.log(`[HOTPATH] Fallback: Enqueued CLOSE command ${commandId} for sub ${copy.subAccountId}`);
          }
        }
      }).catch(err => this.logger.error(`Error querying fallback trade signal: ${err.message}`));
    }

    if (signal && dto.volume !== undefined && dto.volume >= signal.volume) {
      this.activeSignalsByTicket.delete(signalKey);
    }
    
    if (executionCommandsData.length > 0) {
      this.asyncPersistence.enqueueTask('UPDATE_SIGNAL_CLOSE', {
        executionCommands: executionCommandsData,
      });
    }

    return { success: true, message: 'CLOSE processed' };
  }

  /**
   * HOT PATH: processTrigger
   * Preserves native pending-order trigger duplicate prevention.
   */
  async processTrigger(masterAccountId: string, dto: MasterTriggerDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing TRIGGER for master: ${masterAccountId}, order: ${dto.orderTicket} -> pos: ${dto.positionTicket}`);

    // Idempotency / duplicate sequence check (BUG-002)
    if (this.hotDispatch.isDuplicateOrProcessed(masterAccountId, dto.orderTicket, dto.sequenceNumber, dto.eventId)) {
      this.logger.log(`Trigger ${dto.orderTicket} already processed (seq: ${dto.sequenceNumber}, eventId: ${dto.eventId}). Idempotent return.`);
      return { success: true, duplicate: true, message: 'Event already processed' };
    }
    this.hotDispatch.updateSequence(masterAccountId, dto.orderTicket, dto.sequenceNumber);

    const oldKey = this.getSignalKey(masterAccountId, dto.orderTicket);
    const signal = this.activeSignalsByTicket.get(oldKey);
    if (signal) {
      signal.ticket = BigInt(dto.positionTicket);
      signal.sequenceNumber = dto.sequenceNumber;
      this.activeSignalsByTicket.delete(oldKey);
      this.activeSignalsByTicket.set(this.getSignalKey(masterAccountId, dto.positionTicket), signal);

      for (const copy of signal.copies.values()) {
        if (copy.subOrderTicket) {
          // Native trigger duplicate prevention: DO NOT CREATE MARKET OPEN ORDER
          this.logger.log(`[HOTPATH] Pending order ${copy.subOrderTicket} for copy ${copy.id} triggered natively. No market order created.`);
        } else {
          copy.state = CopyState.RECOVERING;
        }
      }
    }

    // Async persistence
    this.asyncPersistence.enqueueTask('UPDATE_SIGNAL_TRIGGER', {
      signalId: signal?.id,
      positionTicket: dto.positionTicket,
      sequenceNumber: dto.sequenceNumber,
      orderTicket: dto.orderTicket,
      masterSignalId: signal?.id,
    });

    return { success: true, message: 'Trigger processed, mapped to new position ticket without duplicate market order' };
  }
}
