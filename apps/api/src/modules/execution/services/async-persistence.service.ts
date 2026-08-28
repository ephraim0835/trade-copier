import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { HotCommandData } from './hot-dispatch.service';
import { CommandStatus, CopyState } from '@prisma/client';
import { RealtimeService } from '../../realtime/realtime.service';

export type PersistenceTaskType =
  | 'PERSIST_SIGNAL_AND_COMMANDS'
  | 'UPDATE_COMMAND_DELIVERED'
  | 'UPDATE_COMMAND_ACK'
  | 'UPDATE_COMMAND_RESULT'
  | 'UPDATE_SIGNAL_MODIFY'
  | 'UPDATE_SIGNAL_CLOSE'
  | 'UPDATE_SIGNAL_TRIGGER';

export interface PersistenceTask {
  id: string;
  type: PersistenceTaskType;
  payload: any;
  retryCount: number;
  createdAt: number;
}

/**
 * AsyncPersistenceService handles asynchronous, batched, fault-tolerant writes to Supabase.
 * 
 * CRITICAL SAFETY RULE:
 * A failure in this service MUST NEVER cause a duplicate trade execution or affect the in-memory hot path.
 * Database writes are retried with exponential backoff.
 */
@Injectable()
export class AsyncPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsyncPersistenceService.name);

  private readonly taskQueue: PersistenceTask[] = [];
  private readonly MAX_QUEUE_SIZE = 10000;
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  onModuleInit() {
    // Start background flush loop every 50ms
    this.flushInterval = setInterval(() => {
      this.processQueue();
    }, 50);
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush remaining items before process exit
    await this.processQueue();
  }

  enqueueTask(type: PersistenceTaskType, payload: any): void {
    if (this.taskQueue.length >= this.MAX_QUEUE_SIZE) {
      this.logger.error(`[AsyncPersistence] Bounded queue capacity exceeded (${this.MAX_QUEUE_SIZE}). Backpressure triggered.`);
      return;
    }

    this.taskQueue.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      retryCount: 0,
      createdAt: Date.now(),
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) return;
    this.isProcessing = true;

    try {
      const batch = this.taskQueue.splice(0, 20); // Process in batches of 20
      for (const task of batch) {
        try {
          await this.executeTask(task);
        } catch (err: any) {
          this.logger.warn(`[AsyncPersistence] Task ${task.id} (${task.type}) failed: ${err.message}. Retrying with backoff...`);
          task.retryCount++;
          if (task.retryCount <= 5) {
            // Re-queue with backoff delay
            setTimeout(() => {
              this.taskQueue.push(task);
            }, Math.min(1000 * Math.pow(2, task.retryCount), 30000));
          } else {
            this.logger.error(`[AsyncPersistence] Task ${task.id} (${task.type}) permanently failed after 5 retries. Stored in error log.`);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeTask(task: PersistenceTask): Promise<void> {
    switch (task.type) {
      case 'PERSIST_SIGNAL_AND_COMMANDS': {
        const { signalData, tradeCopies, executionCommands } = task.payload;
        await this.prisma.$transaction(async (tx) => {
          if (signalData) {
            await tx.tradeSignal.upsert({
              where: { ticket: signalData.ticket },
              create: signalData,
              update: signalData,
            });
          }
          if (tradeCopies && tradeCopies.length > 0) {
            await tx.tradeCopy.createMany({
              data: tradeCopies,
              skipDuplicates: true,
            });
          }
          if (executionCommands && executionCommands.length > 0) {
            await tx.executionCommand.createMany({
              data: executionCommands.map((c: HotCommandData) => ({
                id: c.id,
                tradeCopyId: c.tradeCopyId,
                subAccountId: c.subAccountId,
                status: c.status,
                type: c.type,
                symbol: c.symbol,
                orderType: c.orderType,
                direction: c.direction,
                volume: c.volume,
                price: c.price,
                sl: c.sl,
                tp: c.tp,
                expiresAt: c.expiresAt,
                masterSignalId: c.masterSignalId,
                masterOrderTicket: c.masterOrderTicket,
                masterPositionTicket: c.masterPositionTicket,
                subPositionTicket: c.subPositionTicket,
                subOrderTicket: c.subOrderTicket,
                masterEventDetectedAt: c.masterEventDetectedAt,
                masterEventQueuedAt: c.masterEventQueuedAt,
                masterEventSentAt: c.masterEventSentAt,
                backendReceivedAt: c.backendReceivedAt,
                riskDecisionCompletedAt: c.riskDecisionCompletedAt,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
              skipDuplicates: true,
            });
          }
        });
        break;
      }

      case 'UPDATE_COMMAND_DELIVERED': {
        const { commandIds, deliveredAt } = task.payload;
        await this.prisma.executionCommand.updateMany({
          where: { id: { in: commandIds } },
          data: {
            status: CommandStatus.DELIVERED,
            deliveredAt: new Date(deliveredAt),
          },
        });
        break;
      }

      case 'UPDATE_COMMAND_ACK': {
        const { commandId, acknowledgedAt, subReceivedAt, subAcknowledgedAt } = task.payload;
        await this.prisma.executionCommand.updateMany({
          where: { id: commandId },
          data: {
            status: CommandStatus.ACKNOWLEDGED,
            acknowledgedAt: acknowledgedAt ? new Date(acknowledgedAt) : new Date(),
            subReceivedAt: subReceivedAt ? new Date(subReceivedAt) : undefined,
            subAcknowledgedAt: subAcknowledgedAt ? new Date(subAcknowledgedAt) : undefined,
          },
        });
        break;
      }

      case 'UPDATE_COMMAND_RESULT': {
        const { cmd, result, subTelemetry } = task.payload;
        await this.prisma.$transaction(async (tx) => {
          await tx.executionCommand.updateMany({
            where: { id: cmd.id },
            data: {
              status: cmd.status,
              success: result.success,
              mt5Retcode: result.retcode,
              retcodeDescription: result.retcodeDescription,
              orderTicket: result.orderTicket ? BigInt(result.orderTicket) : null,
              dealTicket: result.dealTicket ? BigInt(result.dealTicket) : null,
              executedVolume: result.executedVolume,
              executedPrice: result.executedPrice,
              requestedPrice: result.requestedPrice,
              brokerError: result.brokerError,
              comment: result.comment,
              executedAt: result.timestamp ? new Date(result.timestamp) : new Date(),
              backendResultReceivedAt: new Date(),
              subReceivedAt: subTelemetry?.subReceivedAt ? new Date(subTelemetry.subReceivedAt) : undefined,
              subAcknowledgedAt: subTelemetry?.subAcknowledgedAt ? new Date(subTelemetry.subAcknowledgedAt) : undefined,
              subExecutionStartedAt: subTelemetry?.subExecutionStartedAt ? new Date(subTelemetry.subExecutionStartedAt) : undefined,
              subExecutionCompletedAt: subTelemetry?.subExecutionCompletedAt ? new Date(subTelemetry.subExecutionCompletedAt) : undefined,
            },
          });

          if (result.success && result.executedVolume) {
            if (cmd.type === 'OPEN_ORDER' && result.orderTicket) {
              await tx.tradeCopy.updateMany({
                where: { id: cmd.tradeCopyId },
                data: {
                  subOrderTicket: BigInt(result.orderTicket),
                  subDealTicket: result.dealTicket ? BigInt(result.dealTicket) : null,
                  subPositionId: BigInt(result.orderTicket),
                  executedVolume: result.executedVolume,
                  state: CopyState.EXECUTED,
                },
              });
            } else if (cmd.type === 'CLOSE_ORDER' || cmd.type === 'CLOSE_PARTIAL') {
              await tx.tradeCopy.updateMany({
                where: { id: cmd.tradeCopyId },
                data: {
                  executedVolume: result.executedVolume,
                  state: CopyState.EXECUTED,
                },
              });
            }
          }
        });
        break;
      }

      case 'UPDATE_SIGNAL_MODIFY': {
        const { signalId, sl, tp, priceOpen, sequenceNumber, executionCommands } = task.payload;
        await this.prisma.$transaction(async (tx) => {
          if (signalId) {
            await tx.tradeSignal.update({
              where: { id: signalId },
              data: {
                sl,
                tp,
                priceOpen,
                sequenceNumber,
              },
            });
          }
          if (executionCommands && executionCommands.length > 0) {
            await tx.executionCommand.createMany({
              data: executionCommands.map((c: HotCommandData) => ({
                id: c.id,
                tradeCopyId: c.tradeCopyId,
                subAccountId: c.subAccountId,
                status: c.status,
                type: c.type,
                symbol: c.symbol,
                orderType: c.orderType,
                direction: c.direction,
                volume: c.volume,
                price: c.price,
                sl: c.sl,
                tp: c.tp,
                expiresAt: c.expiresAt,
                masterSignalId: c.masterSignalId,
                masterOrderTicket: c.masterOrderTicket,
                masterPositionTicket: c.masterPositionTicket,
                subPositionTicket: c.subPositionTicket,
                subOrderTicket: c.subOrderTicket,
                masterEventDetectedAt: c.masterEventDetectedAt,
                masterEventQueuedAt: c.masterEventQueuedAt,
                masterEventSentAt: c.masterEventSentAt,
                backendReceivedAt: c.backendReceivedAt,
                riskDecisionCompletedAt: c.riskDecisionCompletedAt,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
              skipDuplicates: true,
            });
          }
        });
        break;
      }

      case 'UPDATE_SIGNAL_CLOSE': {
        const { executionCommands } = task.payload;
        if (executionCommands && executionCommands.length > 0) {
          await this.prisma.executionCommand.createMany({
            data: executionCommands.map((c: HotCommandData) => ({
              id: c.id,
              tradeCopyId: c.tradeCopyId,
              subAccountId: c.subAccountId,
              status: c.status,
              type: c.type,
              symbol: c.symbol,
              orderType: c.orderType,
              direction: c.direction,
              volume: c.volume,
              price: c.price,
              sl: c.sl,
              tp: c.tp,
              expiresAt: c.expiresAt,
              masterSignalId: c.masterSignalId,
              masterOrderTicket: c.masterOrderTicket,
              masterPositionTicket: c.masterPositionTicket,
              subPositionTicket: c.subPositionTicket,
              subOrderTicket: c.subOrderTicket,
              masterEventDetectedAt: c.masterEventDetectedAt,
              masterEventQueuedAt: c.masterEventQueuedAt,
              masterEventSentAt: c.masterEventSentAt,
              backendReceivedAt: c.backendReceivedAt,
              riskDecisionCompletedAt: c.riskDecisionCompletedAt,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            })),
            skipDuplicates: true,
          });
        }
        break;
      }

      case 'UPDATE_SIGNAL_TRIGGER': {
        const { signalId, positionTicket, sequenceNumber, orderTicket } = task.payload;
        await this.prisma.$transaction(async (tx) => {
          await tx.tradeSignal.update({
            where: { id: signalId },
            data: {
              ticket: BigInt(positionTicket),
              sequenceNumber,
            },
          });
          await tx.executionCommand.updateMany({
            where: { masterOrderTicket: BigInt(orderTicket) },
            data: { masterPositionTicket: BigInt(positionTicket) },
          });
        });
        break;
      }
    }

    this.notifyUsers(task);
  }

  // Simple cache to avoid querying userId repeatedly
  private accountUserCache = new Map<string, string>();

  private async getUserIdForAccount(accountId: string): Promise<string | null> {
    if (this.accountUserCache.has(accountId)) {
      return this.accountUserCache.get(accountId)!;
    }
    const acct = await this.prisma.mt5Account.findUnique({
      where: { id: accountId },
      select: { userId: true }
    });
    if (acct) {
      this.accountUserCache.set(accountId, acct.userId);
      return acct.userId;
    }
    return null;
  }

  private async notifyUsers(task: PersistenceTask) {
    try {
      const accountIdsToNotify = new Set<string>();

      switch (task.type) {
        case 'PERSIST_SIGNAL_AND_COMMANDS': {
          const { signalData, tradeCopies, executionCommands } = task.payload;
          if (signalData?.masterAcctId) accountIdsToNotify.add(signalData.masterAcctId);
          tradeCopies?.forEach((c: any) => accountIdsToNotify.add(c.subAccountId));
          break;
        }
        case 'UPDATE_SIGNAL_MODIFY':
        case 'UPDATE_SIGNAL_CLOSE': {
          const { executionCommands } = task.payload;
          executionCommands?.forEach((c: any) => accountIdsToNotify.add(c.subAccountId));
          break;
        }
        case 'UPDATE_COMMAND_DELIVERED':
        case 'UPDATE_COMMAND_ACK':
        case 'UPDATE_COMMAND_RESULT': {
          const cmd = task.payload.cmd || task.payload;
          if (cmd.subAccountId) accountIdsToNotify.add(cmd.subAccountId);
          if (cmd.masterAccountId) accountIdsToNotify.add(cmd.masterAccountId);
          break;
        }
      }

      for (const accountId of accountIdsToNotify) {
        const userId = await this.getUserIdForAccount(accountId);
        if (userId) {
          this.realtimeService.emit(userId, 'REFRESH');
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to notify realtime service: ${err.message}`);
    }
  }

  getQueueLength(): number {
    return this.taskQueue.length;
  }
}
