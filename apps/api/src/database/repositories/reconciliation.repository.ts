import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CommandStatus, CopyState, ExecutionCommand, TradeCopy, Mt5Account } from '@prisma/client';

@Injectable()
export class ReconciliationRepository {
  constructor(private prisma: PrismaService) {}

  async getAccount(subAccountId: string): Promise<Pick<Mt5Account, 'isDemo' | 'isActive'> | null> {
    return this.prisma.mt5Account.findUnique({
      where: { id: subAccountId },
      select: { isDemo: true, isActive: true }
    });
  }

  async findUnknownCommands(subAccountId: string): Promise<ExecutionCommand[]> {
    return this.prisma.executionCommand.findMany({
      where: {
        subAccountId,
        status: CommandStatus.EXECUTION_UNKNOWN,
      },
    });
  }

  async resolveUnknownCommand(commandId: string, tradeCopyId: string, ticket: string | null, positionTicket: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.executionCommand.update({
        where: { id: commandId },
        data: {
          status: CommandStatus.EXECUTED,
          orderTicket: ticket ? BigInt(ticket) : null,
        },
      });

      await tx.tradeCopy.update({
        where: { id: tradeCopyId },
        data: {
          subOrderTicket: ticket ? BigInt(ticket) : null,
          subPositionId: positionTicket ? BigInt(positionTicket) : null,
        },
      });
    });
  }

  async getActiveCopies(subAccountId: string): Promise<TradeCopy[]> {
    return this.prisma.tradeCopy.findMany({
      where: {
        subAccountId,
        state: CopyState.EXECUTED,
      },
    });
  }

  async mapNativeTrigger(tradeCopyId: string, positionTicket: string): Promise<void> {
    await this.prisma.tradeCopy.update({
      where: { id: tradeCopyId },
      data: {
        subPositionId: BigInt(positionTicket),
      },
    });
  }

  async updateAccountStats(subAccountId: string, balance: number, equity: number, marginFree: number): Promise<void> {
    await this.prisma.mt5Account.update({
      where: { id: subAccountId },
      data: {
        balance,
        equity,
        floatingPl: equity - balance,
        freeMargin: marginFree,
      },
    });
  }
}
