import { Injectable, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterSignalDto, MasterModifyDto, MasterCloseDto, MasterTriggerDto } from '../dto/master-signal.dto';
import { PrismaService } from '../../../database/prisma.service';
import { RiskEngineService } from '../../risk-engine/services/risk-engine.service';
import { HotDispatchService, HotCommandData } from './hot-dispatch.service';
import { AsyncPersistenceService } from './async-persistence.service';
import { CommandType, CommandStatus, CopyState, Mt5Account, CopySettings } from '@prisma/client';
import * as crypto from 'crypto';

interface CachedSubAccount {
  id: string;
  isDemo: boolean;
  isActive: boolean;
  copySettings: CopySettings | null;
  equity: number;
  balance: number;
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
  createdAt: Date;
}

@Injectable()
export class MasterSignalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MasterSignalService.name);
  private sweeperInterval: NodeJS.Timeout | null = null;
  private cacheRefreshInterval: NodeJS.Timeout | null = null;

  // In-memory Sub Accounts & CopySettings cache mapped by MasterAccountId (30s TTL with auto-refresh)
  private subAccountsCache = new Map<string, CachedSubAccount[]>();
  private lastSubCacheRefresh = 0;

  // In-memory active signals and copy mappings (O(1) lookups for modify/close)
  private readonly activeSignalsByTicket = new Map<string, InFlightTradeSignal>();

  private readonly demoOnly: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskEngine: RiskEngineService,
    private readonly hotDispatch: HotDispatchService,
    private readonly asyncPersistence: AsyncPersistenceService,
    private readonly configService: ConfigService,
  ) {
    this.demoOnly = this.configService.get<string>('DEMO_ONLY') === 'true';
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
      // Fetch all active subscriptions including subAccount and copySettings
      // When DEMO_ONLY=true, restrict to demo sub-accounts only
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
          subAccount: {
            include: {
              copySettings: true,
            }
          }
        },
      });

      const newCache = new Map<string, CachedSubAccount[]>();
      
      for (const sub of subscriptions) {
        const a = sub.subAccount;
        
        // Merge the subscription risk override with the account copySettings if needed
        const mergedSettings = a.copySettings ? { ...a.copySettings } : null;
        if (mergedSettings && sub.riskPercentage !== null) {
          mergedSettings.riskPercentage = sub.riskPercentage;
        }

        const cached: CachedSubAccount = {
          id: a.id,
          isDemo: a.isDemo,
          isActive: a.isActive,
          copySettings: mergedSettings,
          equity: a.equity ?? 0,
          balance: a.balance ?? 0,
          freeMargin: a.freeMargin ?? 0,
          currency: a.currency ?? 'USD',
        };

        if (!newCache.has(sub.masterAccountId)) {
          newCache.set(sub.masterAccountId, []);
        }
        newCache.get(sub.masterAccountId)!.push(cached);
      }

      this.subAccountsCache = newCache;
      this.lastSubCacheRefresh = Date.now();
      
      let totalSubs = 0;
      for (const subs of newCache.values()) totalSubs += subs.length;
      this.logger.debug(`[MasterSignal] Sub accounts cache updated: ${totalSubs} active subscriptions mapped`);
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

  private buildRiskProfile(sub: CachedSubAccount) {
    const copySettings = sub.copySettings || ({} as any);
    return {
      equity: sub.equity > 0 ? sub.equity : 10000,
      currency: sub.currency,
      marginFree: sub.freeMargin > 0 ? sub.freeMargin : 10000,
      accountType: 'HEDGING' as const,
      riskPercentage: copySettings.riskPercentage ?? 1.0,
      roundingTolerancePct: copySettings.roundingTolerancePct ?? 2.0,
      dailyRiskEnabled: copySettings.dailyRiskEnabled ?? false,
      maxDailyRisk: copySettings.maxDailyRisk ?? 0,
      maxTradesEnabled: copySettings.maxTradesEnabled ?? false,
      maxActiveTrades: copySettings.maxActiveTrades ?? 0,
      requireTp: copySettings.requireTp ?? true,
      missingSlTimeoutSec: copySettings.missingSlTimeoutSec ?? 60,
      maxRecoveryRRDegradation: copySettings.maxRecoveryRRDegradation ?? 0.5,
      currentDailyRisk: 0,
      currentActiveTrades: 0,
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
   * HOT PATH: processOpen
   * 0 synchronous Supabase queries. In-memory risk evaluation -> HotDispatchService -> Async persistence.
   */
  async processOpen(masterAccountId: string, dto: MasterSignalDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing OPEN for master: ${masterAccountId}, ticket: ${dto.ticket}, seq: ${dto.sequenceNumber}`);

    // 1. In-memory Idempotency check
    const existing = this.hotDispatch.checkIdempotency(masterAccountId, dto.ticket, dto.sequenceNumber || 1, 'OPEN_ORDER');
    if (existing) {
      this.logger.log(`Signal ${dto.ticket} already processed. Idempotent return.`);
      return { success: true, message: 'Already processed' };
    }

    // 2. Validate monotonic sequence
    this.hotDispatch.validateMonotonicSequence(masterAccountId, dto.ticket, dto.sequenceNumber || 1);

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
    for (const sub of subscribedSubs) {
      if (!sub.copySettings || !sub.isActive) continue;
      if (this.demoOnly && !sub.isDemo) continue;

      const riskProfile = this.buildRiskProfile(sub);
      const signalInput = {
        signalId,
        symbol: dto.symbol,
        type: dto.type,
        volume: dto.volume,
        priceOpen: dto.priceOpen,
        sl: dto.sl ?? 0,
        tp: dto.tp ?? 0,
        time: now,
        masterRiskPct: 1.0,
      };

      const decision = this.riskEngine.evaluateTrade(signalInput, riskProfile, symbolSpecs);
      const tradeCopyId = crypto.randomUUID();

      const inFlightCopy: InFlightTradeCopy = {
        id: tradeCopyId,
        signalId,
        subAccountId: sub.id,
        state: decision.state,
        requestedVolume: decision.executedVol,
        createdAt: now,
      };
      inFlightSignal.copies.set(tradeCopyId, inFlightCopy);

      tradeCopiesData.push({
        id: tradeCopyId,
        signalId,
        subAccountId: sub.id,
        state: decision.state,
        requestedVolume: decision.executedVol,
      });

      if (decision.state === CopyState.APPROVED) {
        const commandId = `cmd-open-${tradeCopyId}-${dto.sequenceNumber || Date.now()}`;
        const riskCompletedAt = new Date();

        const hotCmd: HotCommandData = {
          id: commandId,
          tradeCopyId,
          subAccountId: sub.id,
          masterAccountId,
          type: CommandType.OPEN_ORDER,
          status: CommandStatus.CREATED,
          symbol: dto.symbol,
          orderType: dto.type,
          volume: decision.executedVol,
          intendedRisk: decision.intendedRisk,
          price: 0,
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
      }
    }

    // Register active signal in memory
    this.activeSignalsByTicket.set(dto.ticket.toString(), inFlightSignal);

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

    // Monotonic sequence check
    this.hotDispatch.validateMonotonicSequence(masterAccountId, dto.ticket, dto.sequenceNumber);

    const signal = this.activeSignalsByTicket.get(dto.ticket.toString());
    if (!signal) {
      this.logger.warn(`Active signal ${dto.ticket} not in memory. Querying DB fallback asynchronously.`);
    }

    const now = new Date();
    const telemetry = this.calculateMasterTelemetry(dto, backendReceivedAt);

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
            copy.state = CopyState.APPROVED;
            copy.requestedVolume = decision.executedVol;

            const commandId = `cmd-open-${copy.id}-${dto.sequenceNumber}`;
            const hotCmd: HotCommandData = {
              id: commandId,
              tradeCopyId: copy.id,
              subAccountId: copy.subAccountId,
              masterAccountId,
              type: CommandType.OPEN_ORDER,
              status: CommandStatus.CREATED,
              symbol: signal.symbol,
              orderType: signal.type as any,
              volume: decision.executedVol,
              intendedRisk: decision.intendedRisk,
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
        this.logger.log(`[HOTPATH] Enqueued MODIFY command ${commandId} for sub ${copy.subAccountId}, posTicket: ${targetSubPositionTicket}, sl: ${dto.sl}, tp: ${dto.tp}`);
      }
    } else {
      this.logger.warn(`[HOTPATH] Signal ${dto.ticket} not found in RAM for MODIFY. Querying DB fallback asynchronously.`);
      this.prisma.tradeSignal.findUnique({
        where: { ticket: BigInt(dto.ticket) },
        include: { copies: true },
      }).then(async (dbSignal) => {
        if (dbSignal) {
          for (const copy of dbSignal.copies) {
            const commandId = `cmd-mod-${copy.id}-${dto.sequenceNumber}`;
            const targetPos = copy.subPositionId ?? copy.subOrderTicket;
            const hotCmd: HotCommandData = {
              id: commandId,
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
    });

    return { success: true, message: 'MODIFY processed' };
  }

  /**
   * HOT PATH: processClose
   */
  async processClose(masterAccountId: string, dto: MasterCloseDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing CLOSE for master: ${masterAccountId}, ticket: ${dto.ticket}, vol: ${dto.volume}`);

    this.hotDispatch.validateMonotonicSequence(masterAccountId, dto.ticket, dto.sequenceNumber);

    const signal = this.activeSignalsByTicket.get(dto.ticket.toString());
    const now = new Date();
    const telemetry = this.calculateMasterTelemetry(dto, backendReceivedAt);

    if (signal) {
      const isPartial = dto.volume !== undefined && dto.volume < signal.volume;
      const cmdType = isPartial ? CommandType.CLOSE_PARTIAL : CommandType.CLOSE_ORDER;
      const closeFraction = isPartial ? (dto.volume! / signal.volume) : 1.0;

      for (const copy of signal.copies.values()) {
        const isPending = !copy.subPositionId && copy.subOrderTicket;
        let currentVol = copy.executedVolume ?? copy.requestedVolume ?? signal.volume;
        if (currentVol <= 0) currentVol = signal.volume;

        let requestedCloseVol = currentVol * closeFraction;
        if (isPending) requestedCloseVol = copy.requestedVolume || signal.volume;

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
          tradeCopyId: copy.id,
          subAccountId: copy.subAccountId,
          masterAccountId,
          type: isPending ? CommandType.CLOSE_ORDER : cmdType,
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
        this.logger.log(`[HOTPATH] Enqueued CLOSE command ${commandId} for sub ${copy.subAccountId}, posTicket: ${targetSubPositionTicket}, vol: ${requestedCloseVol}`);
      }
    } else {
      this.logger.warn(`[HOTPATH] Signal ${dto.ticket} not found in active RAM cache. Finding trade copies in persistent store.`);
      // Async fallback to find trade copies from DB if active signal cache was evicted/restarted
      this.prisma.tradeSignal.findUnique({
        where: { ticket: BigInt(dto.ticket) },
        include: { copies: true },
      }).then(async (dbSignal) => {
        if (dbSignal) {
          for (const copy of dbSignal.copies) {
            const commandId = `cmd-close-${copy.id}-${dto.sequenceNumber}`;
            const targetPos = copy.subPositionId ?? copy.subOrderTicket;
            const hotCmd: HotCommandData = {
              id: commandId,
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

    return { success: true, message: 'CLOSE processed' };
  }

  /**
   * HOT PATH: processTrigger
   * Preserves native pending-order trigger duplicate prevention.
   */
  async processTrigger(masterAccountId: string, dto: MasterTriggerDto, backendReceivedAt: number) {
    this.logger.debug(`[HOTPATH] Processing TRIGGER for master: ${masterAccountId}, order: ${dto.orderTicket} -> pos: ${dto.positionTicket}`);

    this.hotDispatch.validateMonotonicSequence(masterAccountId, dto.orderTicket, dto.sequenceNumber);

    const signal = this.activeSignalsByTicket.get(dto.orderTicket.toString());
    if (signal) {
      signal.ticket = BigInt(dto.positionTicket);
      signal.sequenceNumber = dto.sequenceNumber;
      this.activeSignalsByTicket.delete(dto.orderTicket.toString());
      this.activeSignalsByTicket.set(dto.positionTicket.toString(), signal);

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
    });

    return { success: true, message: 'Trigger processed, mapped to new position ticket without duplicate market order' };
  }
}
