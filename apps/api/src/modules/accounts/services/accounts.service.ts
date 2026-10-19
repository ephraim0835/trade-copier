import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateCopySettingsDto } from '../dto/update-copy-settings.dto';
import { UpdateTelemetryDto } from '../dto/update-telemetry.dto';
import { RealtimeService } from '../../realtime/realtime.service';

interface CachedAccountState {
  userId: string;
  lastBalance?: number;
  lastPersistAt: number;
  initialBalanceSet: boolean;
}

@Injectable()
export class AccountsService {
  private accountCache = new Map<string, CachedAccountState>();

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
    // If the terminal has no broker currency, it is not connected to any trading account.
    // Do not mark the account ONLINE or wipe provisioningError with empty 0.00 data.
    if (!dto.currency || dto.currency.trim() === '') {
      return { success: false, message: 'Terminal not connected to broker' };
    }

    // Retrieve or populate in-memory account cache for sub-millisecond SSE dispatch
    let cached = this.accountCache.get(accountId);
    if (!cached) {
      const dbAcc = await this.prisma.mt5Account.findUnique({
        where: { id: accountId },
        select: { id: true, userId: true, balance: true, initialBalance: true },
      });

      if (!dbAcc) {
        return { success: false, message: 'Account not found' };
      }

      cached = {
        userId: dbAcc.userId,
        lastBalance: dbAcc.balance ?? undefined,
        lastPersistAt: 0,
        initialBalanceSet: dbAcc.initialBalance !== null && dbAcc.initialBalance !== undefined,
      };
      this.accountCache.set(accountId, cached);
    }

    // [FAST-PATH] Emit SSE immediately to connected browser client (< 1ms in-memory dispatch)
    this.realtimeService.emit(cached.userId, 'REFRESH', {
      type: 'TELEMETRY',
      accountId: accountId,
      floatingPl: dto.floatingPl,
      balance: dto.balance,
      equity: dto.equity,
    });

    // [RESOURCE-EFFICIENT PERSISTENCE]
    // Persist to PostgreSQL only when:
    // 1) First time / initial balance needs to be recorded
    // 2) Balance changed (trade closed, deposit, withdrawal)
    // 3) Periodic heartbeat checkpoint (every 15s)
    const now = Date.now();
    const balanceChanged = cached.lastBalance === undefined || 
      (dto.balance !== undefined && Math.abs(dto.balance - cached.lastBalance) >= 0.01);
    const needsInitialBalance = !cached.initialBalanceSet && typeof dto.balance === 'number' && dto.balance > 0;
    const periodicPersistDue = (now - cached.lastPersistAt) >= 15000;

    if (balanceChanged || needsInitialBalance || periodicPersistDue) {
      cached.lastPersistAt = now;
      if (dto.balance !== undefined) {
        cached.lastBalance = dto.balance;
      }

      const updateData: any = {
        isActive: true,
        connectionStatus: 'ONLINE',
        provisioningError: null,
        lastHeartbeatAt: new Date(),
        balance: dto.balance,
        equity: dto.equity,
        margin: dto.margin,
        freeMargin: dto.freeMargin,
        floatingPl: dto.floatingPl,
        currency: dto.currency,
      };

      if (needsInitialBalance) {
        updateData.initialBalance = dto.balance;
        cached.initialBalanceSet = true;
      }

      await this.prisma.mt5Account.update({
        where: { id: accountId },
        data: updateData,
      });
    }

    return { success: true };
  }
}
