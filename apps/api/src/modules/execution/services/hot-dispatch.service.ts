import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CommandStatus, CommandType, OrderType, PositionType } from '@prisma/client';

export interface HotCommandData {
  id: string;
  tradeCopyId: string;
  subAccountId: string;
  masterAccountId: string;
  type: CommandType;
  status: CommandStatus;
  symbol: string;
  orderType: OrderType;
  direction?: PositionType | null;
  volume: number;
  intendedRisk?: number | null;
  price?: number | null;
  sl?: number | null;
  tp?: number | null;
  magicNumber?: bigint | null;
  sequenceNumber: number;
  masterSignalId?: string | null;
  masterOrderTicket?: bigint | null;
  masterPositionTicket?: bigint | null;
  subOrderTicket?: bigint | null;
  subPositionTicket?: bigint | null;
  
  // Telemetry timestamps
  masterEventDetectedAt?: Date | null;
  masterEventQueuedAt?: Date | null;
  masterEventSentAt?: Date | null;
  backendReceivedAt?: Date | null;
  riskDecisionCompletedAt?: Date | null;
  hotPathCommandAvailableAt: Date;
  deliveredAt?: Date | null;
  acknowledgedAt?: Date | null;
  subReceivedAt?: Date | null;
  subAcknowledgedAt?: Date | null;
  subExecutionStartedAt?: Date | null;
  subExecutionCompletedAt?: Date | null;
  backendResultReceivedAt?: Date | null;
  executedAt?: Date | null;
  expiresAt: Date;

  // Execution outcome details
  success?: boolean | null;
  mt5Retcode?: number | null;
  retcodeDescription?: string | null;
  orderTicket?: bigint | null;
  dealTicket?: bigint | null;
  executedVolume?: number | null;
  executedPrice?: number | null;
  requestedPrice?: number | null;
  brokerError?: string | null;
  comment?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface HotJournalEntry {
  entryType: 'ENQUEUE' | 'DELIVERED' | 'ACK' | 'RESULT' | 'UNKNOWN';
  commandId: string;
  subAccountId: string;
  status: CommandStatus;
  data: Partial<HotCommandData>;
  timestamp: string;
}

export interface IHotDispatchQueue {
  enqueueCommand(cmd: HotCommandData): Promise<HotCommandData>;
  claimPendingCommands(subAccountId: string, maxCount?: number): HotCommandData[];
  acknowledgeCommand(subAccountId: string, commandId: string, subTelemetry?: any): HotCommandData;
  recordExecutionResult(subAccountId: string, result: any, subTelemetry?: any): HotCommandData;
  getCommand(commandId: string): HotCommandData | null;
  checkIdempotency(masterAccountId: string, masterTicket: bigint | string, sequenceNumber: number, eventType: string): HotCommandData | null;
  markExecutionUnknown(commandId: string, reason: string): HotCommandData;
}

/**
 * HotDispatchService provides process-local, microsecond in-memory command queueing
 * with monotonic sequence enforcement, atomic claims, dual-layer idempotency,
 * and crash-recovery journal logging.
 * 
 * ARCHITECTURAL CONSTRAINT:
 * Single API process execution authority. If horizontal scaling is needed in the future,
 * this interface can be backed by Redis Streams without changing the execution engine.
 */
@Injectable()
export class HotDispatchService implements IHotDispatchQueue, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotDispatchService.name);

  // Per-subAccount FIFO queue of active command IDs
  private readonly subQueues = new Map<string, string[]>();

  // Global O(1) command lookup table
  private readonly commandMap = new Map<string, HotCommandData>();

  // Idempotency lookup: "masterAccountId:masterTicket:sequenceNumber:eventType" -> commandId
  private readonly idempotencyIndex = new Map<string, string>();

  // Track highest processed sequence per (masterAccountId + masterTicket) to reject stale/out-of-order signals
  private readonly highestSequenceMap = new Map<string, number>();

  // Journal path for crash-safety WAL
  private readonly journalDir = path.join(process.cwd(), 'data');
  private readonly journalFile = process.env.NODE_ENV === 'test'
    ? path.join(this.journalDir, `test_journal_${Math.random().toString(36).substring(2)}.jsonl`)
    : path.join(this.journalDir, 'hot_command_journal.jsonl');

  // Background timer to sweep expired or stuck DELIVERED/ACKNOWLEDGED commands to EXECUTION_UNKNOWN
  private sweepInterval: NodeJS.Timeout | null = null;

  public disableJournaling = false;

  constructor() {}

  async onModuleInit() {
    this.ensureJournalDirectory();
    this.replayJournal();

    // Start background sweeper every 5 seconds
    this.sweepInterval = setInterval(() => {
      this.sweepStaleCommands();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
  }

  private ensureJournalDirectory() {
    if (this.disableJournaling) return;
    if (!fs.existsSync(this.journalDir)) {
      fs.mkdirSync(this.journalDir, { recursive: true });
    }
  }

  private writeJournal(entryType: HotJournalEntry['entryType'], cmd: HotCommandData) {
    if (this.disableJournaling) return;
    try {
      this.ensureJournalDirectory();
      const entry: HotJournalEntry = {
        entryType,
        commandId: cmd.id,
        subAccountId: cmd.subAccountId,
        status: cmd.status,
        data: cmd,
        timestamp: new Date().toISOString(),
      };
      // Format bigints for JSON
      const json = JSON.stringify(entry, (key, value) => typeof value === 'bigint' ? value.toString() : value);
      fs.appendFileSync(this.journalFile, json + '\n', 'utf8');
    } catch (err: any) {
      this.logger.error(`Failed to write command journal entry: ${err.message}`);
    }
  }

  private replayJournal() {
    if (this.disableJournaling) return;
    if (!fs.existsSync(this.journalFile)) return;

    try {
      const content = fs.readFileSync(this.journalFile, 'utf8');
      const lines = content.split('\n');
      let replayedCount = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry: HotJournalEntry = JSON.parse(line);
          const cmdData = entry.data as HotCommandData;
          if (!cmdData || !cmdData.id) continue;

          // Reconstruct BigInts and Dates
          if (cmdData.masterOrderTicket) cmdData.masterOrderTicket = BigInt(cmdData.masterOrderTicket);
          if (cmdData.masterPositionTicket) cmdData.masterPositionTicket = BigInt(cmdData.masterPositionTicket);
          if (cmdData.subOrderTicket) cmdData.subOrderTicket = BigInt(cmdData.subOrderTicket);
          if (cmdData.subPositionTicket) cmdData.subPositionTicket = BigInt(cmdData.subPositionTicket);
          if (cmdData.orderTicket) cmdData.orderTicket = BigInt(cmdData.orderTicket);
          if (cmdData.dealTicket) cmdData.dealTicket = BigInt(cmdData.dealTicket);
          if (cmdData.magicNumber) cmdData.magicNumber = BigInt(cmdData.magicNumber);

          cmdData.createdAt = new Date(cmdData.createdAt);
          cmdData.updatedAt = new Date(cmdData.updatedAt);
          cmdData.expiresAt = new Date(cmdData.expiresAt);
          if (cmdData.hotPathCommandAvailableAt) cmdData.hotPathCommandAvailableAt = new Date(cmdData.hotPathCommandAvailableAt);

          // Update command map with latest replayed state
          this.commandMap.set(cmdData.id, cmdData);

          // Update idempotency index
          const idemKey = this.buildIdempotencyKey(
            cmdData.masterAccountId,
            cmdData.masterOrderTicket || cmdData.masterPositionTicket || '0',
            cmdData.sequenceNumber,
            cmdData.type
          );
          this.idempotencyIndex.set(idemKey, cmdData.id);

          // Update sequence tracker
          const seqKey = `${cmdData.masterAccountId}:${cmdData.masterOrderTicket || cmdData.masterPositionTicket || '0'}`;
          const currentMax = this.highestSequenceMap.get(seqKey) || 0;
          if (cmdData.sequenceNumber > currentMax) {
            this.highestSequenceMap.set(seqKey, cmdData.sequenceNumber);
          }

          // If command was in DELIVERED/ACKNOWLEDGED/EXECUTING when server crashed,
          // CRITICAL SAFETY RULE: Transition to EXECUTION_UNKNOWN rather than blindly re-executing
          if (
            cmdData.status === CommandStatus.DELIVERED ||
            cmdData.status === CommandStatus.ACKNOWLEDGED ||
            cmdData.status === CommandStatus.EXECUTING
          ) {
            cmdData.status = CommandStatus.EXECUTION_UNKNOWN;
            cmdData.updatedAt = new Date();
            this.logger.warn(`Crash recovery: Command ${cmdData.id} was in-flight (${entry.status}). Transitioned to EXECUTION_UNKNOWN.`);
          }

          // If command was CREATED/QUEUED, re-add to subAccount queue if not expired
          if (cmdData.status === CommandStatus.CREATED || cmdData.status === CommandStatus.QUEUED) {
            if (cmdData.expiresAt.getTime() > Date.now()) {
              if (!this.subQueues.has(cmdData.subAccountId)) {
                this.subQueues.set(cmdData.subAccountId, []);
              }
              const q = this.subQueues.get(cmdData.subAccountId)!;
              if (!q.includes(cmdData.id)) {
                q.push(cmdData.id);
              }
            } else {
              cmdData.status = CommandStatus.EXPIRED;
            }
          }

          replayedCount++;
        } catch (parseErr) {
          // Corrupted journal line: skip gracefully
          this.logger.warn(`Skipping corrupted journal entry: ${line.substring(0, 50)}...`);
        }
      }

      this.logger.log(`Journal replay complete. Restored ${replayedCount} commands from WAL.`);
    } catch (err: any) {
      this.logger.error(`Journal replay failed: ${err.message}`);
    }
  }

  private buildIdempotencyKey(
    masterAccountId: string,
    masterTicket: bigint | string,
    sequenceNumber: number,
    eventType: string
  ): string {
    return `${masterAccountId}:${masterTicket.toString()}:${sequenceNumber}:${eventType}`;
  }

  checkIdempotency(
    masterAccountId: string,
    masterTicket: bigint | string,
    sequenceNumber: number,
    eventType: string
  ): HotCommandData | null {
    const key = this.buildIdempotencyKey(masterAccountId, masterTicket, sequenceNumber, eventType);
    const existingId = this.idempotencyIndex.get(key);
    if (existingId) {
      return this.commandMap.get(existingId) || null;
    }
    return null;
  }

  validateMonotonicSequence(masterAccountId: string, masterTicket: bigint | string, sequenceNumber: number): void {
    const seqKey = `${masterAccountId}:${masterTicket.toString()}`;
    const highest = this.highestSequenceMap.get(seqKey) || 0;
    if (sequenceNumber <= highest) {
      throw new BadRequestException(`Stale/duplicate sequence ${sequenceNumber} <= current ${highest} for ticket ${masterTicket}`);
    }
    this.highestSequenceMap.set(seqKey, sequenceNumber);
  }

  async enqueueCommand(cmd: HotCommandData): Promise<HotCommandData> {
    const now = new Date();
    cmd.status = CommandStatus.QUEUED;
    cmd.createdAt = cmd.createdAt || now;
    cmd.updatedAt = now;
    cmd.hotPathCommandAvailableAt = now;

    // 1. Check idempotency
    const idemKey = this.buildIdempotencyKey(
      cmd.masterAccountId,
      cmd.masterOrderTicket || cmd.masterPositionTicket || '0',
      cmd.sequenceNumber,
      cmd.type
    );
    if (this.idempotencyIndex.has(idemKey)) {
      const existingId = this.idempotencyIndex.get(idemKey)!;
      return this.commandMap.get(existingId)!;
    }

    // 2. Append-Before-Delivery Journal write
    this.writeJournal('ENQUEUE', cmd);

    // 3. Register in in-memory lookups
    this.commandMap.set(cmd.id, cmd);
    this.idempotencyIndex.set(idemKey, cmd.id);

    // 4. Update highest sequence
    const seqKey = `${cmd.masterAccountId}:${(cmd.masterOrderTicket || cmd.masterPositionTicket || '0').toString()}`;
    const currentMax = this.highestSequenceMap.get(seqKey) || 0;
    if (cmd.sequenceNumber > currentMax) {
      this.highestSequenceMap.set(seqKey, cmd.sequenceNumber);
    }

    // 5. Add to SubAccount FIFO queue
    if (!this.subQueues.has(cmd.subAccountId)) {
      this.subQueues.set(cmd.subAccountId, []);
    }
    this.subQueues.get(cmd.subAccountId)!.push(cmd.id);

    this.logger.debug(`[HotDispatch] Enqueued command ${cmd.id} (${cmd.type} ${cmd.symbol} vol ${cmd.volume}) for sub ${cmd.subAccountId}`);
    return cmd;
  }

  /**
   * Atomically claims pending commands for a Sub account.
   * Concurrency-safe: in JavaScript event loop, this synchronous function transitions
   * claimed commands to DELIVERED in a single tick before releasing execution.
   */
  claimPendingCommands(subAccountId: string, maxCount: number = 10): HotCommandData[] {
    const queue = this.subQueues.get(subAccountId);
    if (!queue || queue.length === 0) {
      return [];
    }

    const claimed: HotCommandData[] = [];
    const now = new Date();
    const remainingQueue: string[] = [];

    for (const cmdId of queue) {
      const cmd = this.commandMap.get(cmdId);
      if (!cmd) continue;

      // Check expiry
      if (cmd.expiresAt.getTime() <= now.getTime()) {
        cmd.status = CommandStatus.EXPIRED;
        cmd.updatedAt = now;
        this.writeJournal('UNKNOWN', cmd);
        continue;
      }

      // Claim only QUEUED / CREATED commands
      if (cmd.status === CommandStatus.QUEUED || cmd.status === CommandStatus.CREATED) {
        if (claimed.length < maxCount) {
          cmd.status = CommandStatus.DELIVERED;
          cmd.deliveredAt = now;
          cmd.updatedAt = now;
          claimed.push(cmd);
          this.writeJournal('DELIVERED', cmd);
        } else {
          remainingQueue.push(cmdId);
        }
      }
    }

    this.subQueues.set(subAccountId, remainingQueue);
    return claimed;
  }

  acknowledgeCommand(subAccountId: string, commandId: string, subTelemetry?: any): HotCommandData {
    const cmd = this.commandMap.get(commandId);
    if (!cmd) {
      throw new NotFoundException(`Command ${commandId} not found in hot queue`);
    }

    if (cmd.subAccountId !== subAccountId) {
      throw new BadRequestException(`Command ${commandId} does not belong to sub account ${subAccountId}`);
    }

    // Idempotent return if already acknowledged or in execution
    if (
      cmd.status === CommandStatus.ACKNOWLEDGED ||
      cmd.status === CommandStatus.EXECUTING ||
      cmd.status === CommandStatus.EXECUTED ||
      cmd.status === CommandStatus.REJECTED ||
      cmd.status === CommandStatus.EXECUTION_UNKNOWN
    ) {
      return cmd;
    }

    if (cmd.status !== CommandStatus.DELIVERED) {
      throw new BadRequestException(`Command ${commandId} cannot be acknowledged from invalid state: ${cmd.status}`);
    }

    const now = new Date();
    cmd.status = CommandStatus.ACKNOWLEDGED;
    cmd.acknowledgedAt = now;
    cmd.updatedAt = now;

    if (subTelemetry) {
      if (subTelemetry.subReceivedAt) cmd.subReceivedAt = subTelemetry.subReceivedAt;
      if (subTelemetry.subAcknowledgedAt) cmd.subAcknowledgedAt = subTelemetry.subAcknowledgedAt;
    }

    this.writeJournal('ACK', cmd);
    return cmd;
  }

  recordExecutionResult(subAccountId: string, result: any, subTelemetry?: any): HotCommandData {
    const cmd = this.commandMap.get(result.commandId);
    if (!cmd) {
      throw new NotFoundException(`Command ${result.commandId} not found in hot queue`);
    }

    if (cmd.subAccountId !== subAccountId) {
      throw new BadRequestException(`Command ${result.commandId} does not belong to sub account ${subAccountId}`);
    }

    // Safety: If already EXECUTED or REJECTED, return idempotently
    if (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED) {
      return cmd;
    }

    // Safety: If in EXECUTION_UNKNOWN, only reconciliation can resolve it
    if (cmd.status === CommandStatus.EXECUTION_UNKNOWN) {
      this.logger.warn(`Command ${cmd.id} is in EXECUTION_UNKNOWN. Direct result rejected; must be resolved via reconciliation.`);
      return cmd;
    }

    const now = new Date();
    const nextStatus = result.success ? CommandStatus.EXECUTED : CommandStatus.REJECTED;
    cmd.status = nextStatus;
    cmd.success = result.success;
    cmd.mt5Retcode = result.retcode;
    cmd.retcodeDescription = result.retcodeDescription;
    cmd.orderTicket = result.orderTicket ? BigInt(result.orderTicket) : null;
    cmd.dealTicket = result.dealTicket ? BigInt(result.dealTicket) : null;
    cmd.executedVolume = result.executedVolume;
    cmd.executedPrice = result.executedPrice;
    cmd.requestedPrice = result.requestedPrice;
    cmd.brokerError = result.brokerError;
    cmd.comment = result.comment;
    cmd.executedAt = result.timestamp ? new Date(result.timestamp) : now;
    cmd.backendResultReceivedAt = now;
    cmd.updatedAt = now;

    if (subTelemetry) {
      if (subTelemetry.subReceivedAt) cmd.subReceivedAt = subTelemetry.subReceivedAt;
      if (subTelemetry.subAcknowledgedAt) cmd.subAcknowledgedAt = subTelemetry.subAcknowledgedAt;
      if (subTelemetry.subExecutionStartedAt) cmd.subExecutionStartedAt = subTelemetry.subExecutionStartedAt;
      if (subTelemetry.subExecutionCompletedAt) cmd.subExecutionCompletedAt = subTelemetry.subExecutionCompletedAt;
    }

    this.writeJournal('RESULT', cmd);
    return cmd;
  }

  getCommand(commandId: string): HotCommandData | null {
    return this.commandMap.get(commandId) || null;
  }

  getAllCommands(): HotCommandData[] {
    return Array.from(this.commandMap.values());
  }

  markExecutionUnknown(commandId: string, reason: string): HotCommandData {
    const cmd = this.commandMap.get(commandId);
    if (!cmd) {
      throw new NotFoundException(`Command ${commandId} not found in hot queue`);
    }

    // Cannot transition terminal states
    if (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED) {
      return cmd;
    }

    const now = new Date();
    cmd.status = CommandStatus.EXECUTION_UNKNOWN;
    cmd.comment = `EXECUTION_UNKNOWN: ${reason}`;
    cmd.updatedAt = now;

    this.writeJournal('UNKNOWN', cmd);
    this.logger.warn(`[HotDispatch] Command ${commandId} transitioned to EXECUTION_UNKNOWN (${reason}). Locked against automatic retry.`);
    return cmd;
  }

  private sweepStaleCommands() {
    const now = Date.now();
    const timeoutThresholdMs = 60000; // 60s without ACK/result -> EXECUTION_UNKNOWN

    for (const [id, cmd] of this.commandMap.entries()) {
      // Check DELIVERED or ACKNOWLEDGED commands exceeding timeout
      if (
        (cmd.status === CommandStatus.DELIVERED || cmd.status === CommandStatus.ACKNOWLEDGED || cmd.status === CommandStatus.EXECUTING) &&
        cmd.deliveredAt &&
        now - cmd.deliveredAt.getTime() > timeoutThresholdMs
      ) {
        this.markExecutionUnknown(id, `No execution result received within ${timeoutThresholdMs}ms of delivery`);
      }

      // Clean up completed commands older than 10 minutes to prevent memory leaks
      if (
        (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED || cmd.status === CommandStatus.EXPIRED) &&
        now - cmd.updatedAt.getTime() > 10 * 60000
      ) {
        // Safe eviction from memory (already flushed to journal and Supabase)
        this.commandMap.delete(id);
      }
    }
  }

  // Helper for test assertions and inspection
  getAllActiveCommands(subAccountId?: string): HotCommandData[] {
    const cmds = Array.from(this.commandMap.values());
    if (subAccountId) {
      return cmds.filter(c => c.subAccountId === subAccountId);
    }
    return cmds;
  }

  clearAllMemory() {
    this.subQueues.clear();
    this.commandMap.clear();
    this.idempotencyIndex.clear();
    this.highestSequenceMap.clear();
  }
}
