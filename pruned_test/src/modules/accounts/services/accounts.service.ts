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

    const settings = await this.prisma.copySettings.upsert({
      where: { mt5AccountId: accountId },
      update: dto,
      create: {
        mt5AccountId: accountId,
        ...dto,
      },
    });
    
    this.realtimeService.emit(account.userId, 'REFRESH');

    return settings;
  }

  async updateTelemetry(accountId: string, dto: UpdateTelemetryDto) {
    const account = await this.prisma.mt5Account.update({
      where: { id: accountId },
      data: {
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
