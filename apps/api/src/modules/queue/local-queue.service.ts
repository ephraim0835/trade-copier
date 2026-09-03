import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Database from 'better-sqlite3';
import { IHotDispatchQueue, HotCommandData } from '../execution/services/hot-dispatch.service';
import { CommandStatus } from '@prisma/client';

@Injectable()
export class LocalQueueService implements IHotDispatchQueue, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocalQueueService.name);
  private db: Database.Database;
  private sweepInterval: NodeJS.Timeout | null = null;
  private readonly dbPath: string;

  constructor(private configService: ConfigService) {
    const defaultDataDir = path.join(process.cwd(), 'data');
    this.dbPath = this.configService.get<string>('QUEUE_DB_PATH', path.join(defaultDataDir, 'hot_queue.db'));
  }

  onModuleInit() {
    // 1. Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 2. Initialize better-sqlite3 DB
    this.db = new Database(this.dbPath, { timeout: 5000 });

    // 3. Enable WAL mode & Synchronous config for Durability/Speed balance
    this.db.pragma('journal_mode = WAL');
    // NORMAL is safe in WAL mode for most app-level crash resilience without extreme I/O penalties.
    // FULL is stricter but much slower. We use NORMAL as standard for WAL.
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000'); // Block up to 5s if locked

    // 4. Create Schema
    this.initSchema();

    // 5. Recover Crash State
    this.recoverState();

    // 6. Start Background Sweeper
    this.sweepInterval = setInterval(() => {
      this.sweepStaleCommands();
    }, 5000);
    this.logger.log(`Initialized LocalQueueService at ${this.dbPath} with WAL mode.`);
  }

  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    if (this.db) {
      this.db.close();
    }
    this.logger.log('LocalQueueService gracefully shut down.');
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        eventId TEXT,
        subAccountId TEXT NOT NULL,
        masterAccountId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        symbol TEXT NOT NULL,
        sequenceNumber INTEGER NOT NULL,
        masterOrderTicket TEXT,
        masterPositionTicket TEXT,
        payload TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        deliveredAt INTEGER,
        acknowledgedAt INTEGER
      );
      
      -- Index for ultra-fast polling claims
      CREATE INDEX IF NOT EXISTS idx_poll ON commands(subAccountId, status, sequenceNumber);
      
      -- Idempotency constraint
      CREATE UNIQUE INDEX IF NOT EXISTS idx_idem ON commands(eventId);
      
      -- Index for sweeping
      CREATE INDEX IF NOT EXISTS idx_sweep ON commands(status, deliveredAt);
    `);
  }

  private recoverState() {
    // If the server crashed while commands were in flight, we must transition them
    // to EXECUTION_UNKNOWN because we cannot guarantee whether the broker executed them.
    const stmt = this.db.prepare(`
      UPDATE commands 
      SET status = ?, 
          updatedAt = ?,
          payload = json_set(payload, '$.status', ?, '$.updatedAt', ?, '$.comment', 'Crash Recovery: EXECUTION_UNKNOWN')
      WHERE status IN (?, ?, ?)
    `);

    const now = Date.now();
    const result = stmt.run(
      CommandStatus.EXECUTION_UNKNOWN,
      now,
      CommandStatus.EXECUTION_UNKNOWN,
      new Date(now).toISOString(),
      CommandStatus.DELIVERED,
      CommandStatus.ACKNOWLEDGED,
      CommandStatus.EXECUTING
    );

    if (result.changes > 0) {
      this.logger.warn(`Crash Recovery: ${result.changes} in-flight commands transitioned to EXECUTION_UNKNOWN to prevent blind retries.`);
    }
  }

  // Helper for JSON serialization with BigInt support
  private serializePayload(data: HotCommandData): string {
    return JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  private deserializePayload(json: string): HotCommandData {
    const data = JSON.parse(json);
    
    // Reconstruct Types
    if (data.masterOrderTicket) data.masterOrderTicket = BigInt(data.masterOrderTicket);
    if (data.masterPositionTicket) data.masterPositionTicket = BigInt(data.masterPositionTicket);
    if (data.subOrderTicket) data.subOrderTicket = BigInt(data.subOrderTicket);
    if (data.subPositionTicket) data.subPositionTicket = BigInt(data.subPositionTicket);
    if (data.orderTicket) data.orderTicket = BigInt(data.orderTicket);
    if (data.dealTicket) data.dealTicket = BigInt(data.dealTicket);
    if (data.magicNumber) data.magicNumber = BigInt(data.magicNumber);

    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    if (data.hotPathCommandAvailableAt) data.hotPathCommandAvailableAt = new Date(data.hotPathCommandAvailableAt);
    if (data.deliveredAt) data.deliveredAt = new Date(data.deliveredAt);
    if (data.acknowledgedAt) data.acknowledgedAt = new Date(data.acknowledgedAt);
    if (data.subReceivedAt) data.subReceivedAt = new Date(data.subReceivedAt);
    if (data.subAcknowledgedAt) data.subAcknowledgedAt = new Date(data.subAcknowledgedAt);
    if (data.subExecutionStartedAt) data.subExecutionStartedAt = new Date(data.subExecutionStartedAt);
    if (data.subExecutionCompletedAt) data.subExecutionCompletedAt = new Date(data.subExecutionCompletedAt);
    if (data.backendReceivedAt) data.backendReceivedAt = new Date(data.backendReceivedAt);
    if (data.backendResultReceivedAt) data.backendResultReceivedAt = new Date(data.backendResultReceivedAt);
    if (data.executedAt) data.executedAt = new Date(data.executedAt);
    if (data.masterEventDetectedAt) data.masterEventDetectedAt = new Date(data.masterEventDetectedAt);
    if (data.masterEventQueuedAt) data.masterEventQueuedAt = new Date(data.masterEventQueuedAt);
    if (data.masterEventSentAt) data.masterEventSentAt = new Date(data.masterEventSentAt);
    if (data.riskDecisionCompletedAt) data.riskDecisionCompletedAt = new Date(data.riskDecisionCompletedAt);

    return data as HotCommandData;
  }

  checkIdempotency(eventId: string): HotCommandData | null {
    if (!eventId) return null;
    const stmt = this.db.prepare(`
      SELECT payload FROM commands 
      WHERE eventId = ?
    `);
    const row = stmt.get(eventId) as { payload: string } | undefined;
    if (row) {
      return this.deserializePayload(row.payload);
    }
    return null;
  }

  async enqueueCommand(cmd: HotCommandData): Promise<HotCommandData> {
    const now = new Date();
    cmd.status = CommandStatus.QUEUED;
    cmd.createdAt = cmd.createdAt || now;
    cmd.updatedAt = now;
    cmd.hotPathCommandAvailableAt = now;

    // Check Idempotency First
    if (cmd.eventId) {
      const existing = this.checkIdempotency(cmd.eventId);
      if (existing) return existing;
    }

    const stmt = this.db.prepare(`
      INSERT INTO commands (
        id, eventId, subAccountId, masterAccountId, type, status, symbol, sequenceNumber, 
        masterOrderTicket, masterPositionTicket, payload, createdAt, updatedAt, expiresAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        cmd.id,
        cmd.eventId || null,
        cmd.subAccountId,
        cmd.masterAccountId,
        cmd.type,
        cmd.status,
        cmd.symbol,
        cmd.sequenceNumber,
        cmd.masterOrderTicket?.toString() || null,
        cmd.masterPositionTicket?.toString() || null,
        this.serializePayload(cmd),
        cmd.createdAt.getTime(),
        cmd.updatedAt.getTime(),
        cmd.expiresAt.getTime()
      );
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' && cmd.eventId) {
        const raceExisting = this.checkIdempotency(cmd.eventId);
        if (raceExisting) return raceExisting;
      }
      throw err;
    }

    return cmd;
  }

  claimPendingCommands(subAccountId: string, maxCount: number = 10): HotCommandData[] {
    const now = Date.now();

    // Use a short synchronous transaction to claim commands atomically
    const claimTx = this.db.transaction(() => {
      // 1. Select up to maxCount QUEUED commands for this subAccount, strictly ordered by sequenceNumber
      const selectStmt = this.db.prepare(`
        SELECT payload FROM commands 
        WHERE subAccountId = ? AND status = ? AND expiresAt > ?
        ORDER BY sequenceNumber ASC
        LIMIT ?
      `);
      const rows = selectStmt.all(subAccountId, CommandStatus.QUEUED, now) as { payload: string }[];
      
      if (rows.length === 0) return [];

      const claimed: HotCommandData[] = [];
      const updateStmt = this.db.prepare(`
        UPDATE commands 
        SET status = ?, 
            deliveredAt = ?, 
            updatedAt = ?,
            payload = json_set(payload, '$.status', ?, '$.deliveredAt', ?, '$.updatedAt', ?)
        WHERE id = ?
      `);

      const nowIso = new Date(now).toISOString();

      for (const row of rows) {
        const cmd = this.deserializePayload(row.payload);
        cmd.status = CommandStatus.DELIVERED;
        cmd.deliveredAt = new Date(now);
        cmd.updatedAt = new Date(now);

        updateStmt.run(
          CommandStatus.DELIVERED,
          now,
          now,
          CommandStatus.DELIVERED,
          nowIso,
          nowIso,
          cmd.id
        );
        claimed.push(cmd);
      }

      return claimed;
    });

    return claimTx();
  }

  acknowledgeCommand(subAccountId: string, commandId: string, subTelemetry?: any): HotCommandData {
    const selectStmt = this.db.prepare(`SELECT payload FROM commands WHERE id = ?`);
    const row = selectStmt.get(commandId) as { payload: string } | undefined;
    
    if (!row) {
      throw new NotFoundException(`Command ${commandId} not found in queue`);
    }

    const cmd = this.deserializePayload(row.payload);
    
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

    const now = Date.now();
    cmd.status = CommandStatus.ACKNOWLEDGED;
    cmd.acknowledgedAt = new Date(now);
    cmd.updatedAt = new Date(now);

    if (subTelemetry) {
      if (subTelemetry.subReceivedAt) cmd.subReceivedAt = subTelemetry.subReceivedAt;
      if (subTelemetry.subAcknowledgedAt) cmd.subAcknowledgedAt = subTelemetry.subAcknowledgedAt;
    }

    const updateStmt = this.db.prepare(`
      UPDATE commands 
      SET status = ?, 
          acknowledgedAt = ?, 
          updatedAt = ?,
          payload = ?
      WHERE id = ?
    `);

    updateStmt.run(
      cmd.status,
      now,
      now,
      this.serializePayload(cmd),
      cmd.id
    );

    return cmd;
  }

  recordExecutionResult(subAccountId: string, result: any, subTelemetry?: any): HotCommandData {
    const selectStmt = this.db.prepare(`SELECT payload FROM commands WHERE id = ?`);
    const row = selectStmt.get(result.commandId) as { payload: string } | undefined;
    
    if (!row) {
      throw new NotFoundException(`Command ${result.commandId} not found in queue`);
    }

    const cmd = this.deserializePayload(row.payload);

    if (cmd.subAccountId !== subAccountId) {
      throw new BadRequestException(`Command ${result.commandId} does not belong to sub account ${subAccountId}`);
    }

    if (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED) {
      return cmd;
    }

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

    const updateStmt = this.db.prepare(`
      UPDATE commands 
      SET status = ?, 
          updatedAt = ?,
          payload = ?
      WHERE id = ?
    `);

    updateStmt.run(cmd.status, now.getTime(), this.serializePayload(cmd), cmd.id);
    return cmd;
  }

  getCommand(commandId: string): HotCommandData | null {
    const stmt = this.db.prepare(`SELECT payload FROM commands WHERE id = ?`);
    const row = stmt.get(commandId) as { payload: string } | undefined;
    if (row) {
      return this.deserializePayload(row.payload);
    }
    return null;
  }

  markExecutionUnknown(commandId: string, reason: string): HotCommandData {
    const selectStmt = this.db.prepare(`SELECT payload FROM commands WHERE id = ?`);
    const row = selectStmt.get(commandId) as { payload: string } | undefined;
    
    if (!row) {
      throw new NotFoundException(`Command ${commandId} not found in queue`);
    }

    const cmd = this.deserializePayload(row.payload);

    if (cmd.status === CommandStatus.EXECUTED || cmd.status === CommandStatus.REJECTED) {
      return cmd;
    }

    const now = Date.now();
    cmd.status = CommandStatus.EXECUTION_UNKNOWN;
    cmd.comment = `EXECUTION_UNKNOWN: ${reason}`;
    cmd.updatedAt = new Date(now);

    const updateStmt = this.db.prepare(`
      UPDATE commands 
      SET status = ?, 
          updatedAt = ?,
          payload = ?
      WHERE id = ?
    `);

    updateStmt.run(cmd.status, now, this.serializePayload(cmd), cmd.id);
    this.logger.warn(`Command ${commandId} transitioned to EXECUTION_UNKNOWN (${reason}). Locked against automatic retry.`);
    return cmd;
  }

  private sweepStaleCommands() {
    const now = Date.now();
    const timeoutThresholdMs = 60000; // 60s without ACK/result -> EXECUTION_UNKNOWN
    
    const staleLimit = now - timeoutThresholdMs;

    const tx = this.db.transaction(() => {
      // 1. Mark stale DELIVERED/ACKNOWLEDGED/EXECUTING commands as EXECUTION_UNKNOWN
      const markUnknownStmt = this.db.prepare(`
        SELECT payload FROM commands 
        WHERE status IN (?, ?, ?) AND deliveredAt < ?
      `);
      const staleRows = markUnknownStmt.all(
        CommandStatus.DELIVERED, 
        CommandStatus.ACKNOWLEDGED, 
        CommandStatus.EXECUTING, 
        staleLimit
      ) as { payload: string }[];

      if (staleRows.length > 0) {
        const updateUnknownStmt = this.db.prepare(`
          UPDATE commands 
          SET status = ?, updatedAt = ?, payload = json_set(payload, '$.status', ?, '$.updatedAt', ?, '$.comment', 'EXECUTION_UNKNOWN: No execution result received within timeout')
          WHERE id = ?
        `);
        for (const row of staleRows) {
          const cmd = this.deserializePayload(row.payload);
          const isoNow = new Date(now).toISOString();
          updateUnknownStmt.run(CommandStatus.EXECUTION_UNKNOWN, now, CommandStatus.EXECUTION_UNKNOWN, isoNow, cmd.id);
          this.logger.warn(`Sweeper: Command ${cmd.id} transitioned to EXECUTION_UNKNOWN (timed out).`);
        }
      }

      // 2. Mark EXPIRED QUEUED commands
      const markExpiredStmt = this.db.prepare(`
        UPDATE commands 
        SET status = ?, updatedAt = ?, payload = json_set(payload, '$.status', ?, '$.updatedAt', ?)
        WHERE status = ? AND expiresAt <= ?
      `);
      const expNow = new Date(now).toISOString();
      const expiredCount = markExpiredStmt.run(
        CommandStatus.EXPIRED, now, CommandStatus.EXPIRED, expNow, 
        CommandStatus.QUEUED, now
      );
      if (expiredCount.changes > 0) {
        this.logger.debug(`Sweeper: Expired ${expiredCount.changes} QUEUED commands.`);
      }

      // 3. Delete terminal commands older than 10 minutes to keep queue DB small
      const deleteLimit = now - 10 * 60000;
      const deleteStmt = this.db.prepare(`
        DELETE FROM commands 
        WHERE status IN (?, ?, ?) AND updatedAt < ?
      `);
      const deleteCount = deleteStmt.run(
        CommandStatus.EXECUTED, CommandStatus.REJECTED, CommandStatus.EXPIRED, deleteLimit
      );
      if (deleteCount.changes > 0) {
        this.logger.debug(`Sweeper: Purged ${deleteCount.changes} old terminal commands from local DB.`);
      }
    });

    try {
      tx();
    } catch (err: any) {
      this.logger.error(`Sweeper encountered an error: ${err.message}`);
    }
  }

  // Helper for test assertions and inspection
  getAllActiveCommands(subAccountId?: string): HotCommandData[] {
    let rows: { payload: string }[];
    if (subAccountId) {
      rows = this.db.prepare(`SELECT payload FROM commands WHERE subAccountId = ?`).all(subAccountId) as { payload: string }[];
    } else {
      rows = this.db.prepare(`SELECT payload FROM commands`).all() as { payload: string }[];
    }
    return rows.map(r => this.deserializePayload(r.payload));
  }

  clearAllMemory() {
    this.db.exec(`DELETE FROM commands`);
  }
}
