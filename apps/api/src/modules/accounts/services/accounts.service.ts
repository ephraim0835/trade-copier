import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateCopySettingsDto } from '../dto/update-copy-settings.dto';
import { UpdateTelemetryDto } from '../dto/update-telemetry.dto';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  async updateCopySettings(accountId: string, dto: UpdateCopySettingsDto) {
    const account = await this.prisma.mt5Account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Split displayName out — it lives on Mt5Account, not CopySettings
    const { displayName, ...copySettingsData } = dto;

    if (displayName !== undefined) {
      await this.prisma.mt5Account.update({
        where: { id: accountId },
        // @ts-ignore: Prisma client needs to be reloaded in VS Code to see displayName
        data: { displayName: displayName ?? null },
      });
    }

    const settings = await this.prisma.copySettings.upsert({
      where: { mt5AccountId: accountId },
      update: copySettingsData,
      create: {
        mt5AccountId: accountId,
        ...copySettingsData,
      },
    });
    
    this.realtimeService.emit(account.userId, 'REFRESH');

    return settings;
  }

  async updateTelemetry(accountId: string, dto: UpdateTelemetryDto) {
    const account = await this.prisma.mt5Account.update({
      where: { id: accountId },
      data: {
        isActive: true,
        connectionStatus: 'ONLINE',
        lastHeartbeatAt: new Date(),
        balance: dto.balance,
        equity: dto.equity,
        margin: dto.margin,
        freeMargin: dto.freeMargin,
        floatingPl: dto.floatingPl,
        currency: dto.currency,
      },
    });
    
    this.realtimeService.emit(account.userId, 'REFRESH');
    
    return { success: true };
  }
}
