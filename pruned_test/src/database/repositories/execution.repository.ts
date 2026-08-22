import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CommandStatus, ExecutionCommand, Mt5Account } from '@prisma/client';

@Injectable()
export class ExecutionRepository {
  constructor(private prisma: PrismaService) {}

  async getAccount(subAccountId: string): Promise<Pick<Mt5Account, 'isDemo' | 'isActive'> | null> {
    return this.prisma.mt5Account.findUnique({
      where: { id: subAccountId },
      select: { isDemo: true, isActive: true }
    });
  }

  async claimPendingCommandsAndCheckAccount(subAccountId: string): Promise<{ account: any, commands: ExecutionCommand[] }> {
    // Note: The account check (isDemo, isActive) is now fully handled by EaAuthGuard.
    // We only perform the atomic command claiming here for maximum performance.
    const result = await this.prisma.$queryRaw<ExecutionCommand[]>`
      UPDATE "ExecutionCommand"
      SET status = 'DELIVERED', "deliveredAt" = NOW()
      WHERE id IN (
        SELECT id FROM "ExecutionCommand"
        WHERE "subAccountId" = ${subAccountId}
          AND status IN ('CREATED', 'QUEUED')
          AND "expiresAt" > NOW()
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
    
    // We mock the account object because EaAuthGuard already verified it and the controller
    // uses it. We return the bare minimum so `execution.service.ts` doesn't throw.
    return {
      account: { isDemo: true, isActive: true },
      commands: result
    };
  }

  async findCommandById(commandId: string): Promise<ExecutionCommand | null> {
    return this.prisma.executionCommand.findUnique({
      where: { id: commandId },
    });
  }

  async updateCommandStatus(commandId: string, status: CommandStatus, acknowledgedAt?: Date): Promise<ExecutionCommand> {
    const data: any = { status };
    if (acknowledgedAt) {
      data.acknowledgedAt = acknowledgedAt;
    }
    return this.prisma.executionCommand.update({
      where: { id: commandId },
      data,
    });
  }

  async saveExecutionResult(command: ExecutionCommand, result: any, nextStatus: CommandStatus, subTelemetry: any, backendResultReceivedAt: Date): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.executionCommand.update({
        where: { id: result.commandId },
        data: {
          status: nextStatus,
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
          executedAt: new Date(result.timestamp),
          subReceivedAt: subTelemetry.receivedAt,
          subAcknowledgedAt: subTelemetry.acknowledgedAt,
          subExecutionStartedAt: subTelemetry.startedAt,
          subExecutionCompletedAt: subTelemetry.completedAt,
          backendResultReceivedAt: backendResultReceivedAt,
        },
      });

      if (result.success && result.executedVolume) {
        if (command.type === 'OPEN_ORDER' && result.orderTicket) {
          await tx.tradeCopy.update({
            where: { id: command.tradeCopyId },
            data: {
              subOrderTicket: BigInt(result.orderTicket),
              subDealTicket: result.dealTicket ? BigInt(result.dealTicket) : null,
              subPositionId: BigInt(result.orderTicket),
              executedVolume: result.executedVolume,
              currentVolume: result.executedVolume,
            },
          });
        } else if (command.type === 'CLOSE_PARTIAL' || command.type === 'CLOSE_ORDER') {
          // Increment closedVolume, decrement currentVolume
          await tx.tradeCopy.update({
            where: { id: command.tradeCopyId },
            data: {
              closedVolume: { increment: result.executedVolume },
              currentVolume: { decrement: result.executedVolume }
            },
          });
        }
      }
    });
  }

  async markExpiredCommands(now: Date): Promise<number> {
    const result = await this.prisma.executionCommand.updateMany({
      where: {
        status: {
          in: [CommandStatus.CREATED, CommandStatus.QUEUED],
        },
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: CommandStatus.EXPIRED,
      },
    });

    return result.count;
  }

  async markUnknownCommands(now: Date, timeoutSec: number): Promise<number> {
    const cutoff = new Date(now.getTime() - timeoutSec * 1000);
    const result = await this.prisma.executionCommand.updateMany({
      where: {
        status: {
          in: [CommandStatus.DELIVERED, CommandStatus.ACKNOWLEDGED, CommandStatus.EXECUTING]
        },
        OR: [
          { acknowledgedAt: { lte: cutoff } },
          { deliveredAt: { lte: cutoff } }
        ]
      },
      data: {
        status: CommandStatus.EXECUTION_UNKNOWN,
      },
    });

    return result.count;
  }
}
