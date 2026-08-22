import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { HotDispatchService, HotCommandData } from './hot-dispatch.service';
import { AsyncPersistenceService } from './async-persistence.service';
import { CommandDto } from '../dto/command.dto';
import { ExecutionResultDto } from '../dto/execution-result.dto';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly hotDispatch: HotDispatchService,
    private readonly asyncPersistence: AsyncPersistenceService
  ) {}

  /**
   * HOT PATH: getPendingCommands (/execution/poll)
   * Claims commands directly from in-memory queue in < 1ms.
   * 0 synchronous Supabase queries.
   */
  async getPendingCommands(subAccountId: string): Promise<CommandDto[]> {
    const claimedCommands = this.hotDispatch.claimPendingCommands(subAccountId, 10);

    if (claimedCommands.length > 0) {
      this.logger.debug(`[HOTPATH] Claimed ${claimedCommands.length} commands for sub ${subAccountId}`);

      // Non-blocking async persistence of DELIVERED status
      this.asyncPersistence.enqueueTask('UPDATE_COMMAND_DELIVERED', {
        commandIds: claimedCommands.map(c => c.id),
        deliveredAt: new Date(),
      });
    }

    return claimedCommands.map((c: HotCommandData) => ({
      commandId: c.id,
      tradeCopyId: c.tradeCopyId,
      type: c.type,
      masterSignalId: c.masterSignalId ?? undefined,
      masterOrderTicket: c.masterOrderTicket?.toString(),
      masterPositionTicket: c.masterPositionTicket?.toString(),
      subPositionTicket: c.subPositionTicket?.toString() ?? undefined,
      subOrderTicket: c.subOrderTicket?.toString() ?? undefined,
      sequenceNumber: c.sequenceNumber,
      symbol: c.symbol,
      orderType: c.orderType,
      direction: c.direction ?? undefined,
      volume: c.volume,
      price: c.price ?? undefined,
      sl: c.sl ?? undefined,
      tp: c.tp ?? undefined,
      magicNumber: c.magicNumber?.toString(),
      expiresAt: new Date(c.expiresAt).toISOString(),
    }));
  }

  /**
   * HOT PATH: acknowledgeCommand (/execution/ack)
   * Transitions state to ACKNOWLEDGED in memory immediately (< 0.1ms).
   */
  async acknowledgeCommand(subAccountId: string, commandId: string, subTelemetry?: any): Promise<void> {
    if (!commandId) {
      throw new BadRequestException('commandId is required');
    }

    const cmd = this.hotDispatch.acknowledgeCommand(subAccountId, commandId, subTelemetry);

    // Non-blocking async persistence of ACK
    this.asyncPersistence.enqueueTask('UPDATE_COMMAND_ACK', {
      commandId: cmd.id,
      acknowledgedAt: cmd.acknowledgedAt,
      subReceivedAt: cmd.subReceivedAt,
      subAcknowledgedAt: cmd.subAcknowledgedAt,
    });
  }

  /**
   * HOT PATH: processExecutionResult (/execution/result)
   * Updates state to EXECUTED/REJECTED in memory immediately (< 0.1ms).
   */
  async processExecutionResult(subAccountId: string, result: ExecutionResultDto, backendResultReceivedAt?: number): Promise<void> {
    if (!result.commandId) {
      throw new BadRequestException('commandId is required');
    }

    // Extract microsecond telemetry if present
    let subTelemetry: any = null;
    if (result.subExecutionCompletedAt) {
      const networkLatencyMs = 1;
      const t11Ms = (backendResultReceivedAt || Date.now()) - networkLatencyMs;
      
      const t10Ms = t11Ms;
      const t9Wait = result.subExecutionStartedAt ? (Number(result.subExecutionCompletedAt) - Number(result.subExecutionStartedAt)) / 1000 : 0;
      const t8Wait = (result.subAcknowledgedAt && result.subExecutionStartedAt) ? (Number(result.subExecutionStartedAt) - Number(result.subAcknowledgedAt)) / 1000 : 0;
      const t7Wait = (result.subReceivedAt && result.subAcknowledgedAt) ? (Number(result.subAcknowledgedAt) - Number(result.subReceivedAt)) / 1000 : 0;

      const t9Ms = t10Ms - t9Wait;
      const t8Ms = t9Ms - t8Wait;
      const t7Ms = t8Ms - t7Wait;

      subTelemetry = {
        subReceivedAt: new Date(t7Ms),
        subAcknowledgedAt: new Date(t8Ms),
        subExecutionStartedAt: new Date(t9Ms),
        subExecutionCompletedAt: new Date(t10Ms),
      };
    }

    const cmd = this.hotDispatch.recordExecutionResult(subAccountId, result, subTelemetry);

    this.logger.debug(`[HOTPATH] Result recorded for command ${cmd.id}: success=${result.success}, retcode=${result.retcode}`);

    // Non-blocking async persistence of execution result & trade mapping
    this.asyncPersistence.enqueueTask('UPDATE_COMMAND_RESULT', {
      cmd,
      result,
      subTelemetry,
    });
  }

  async markExpiredCommands(): Promise<number> {
    // HotDispatch handles expiration automatically in-memory on claim
    return 0;
  }
}
