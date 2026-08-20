import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { Mt5Account } from '@prisma/client';

@Injectable()
export class EaAuthService {
  private readonly logger = new Logger(EaAuthService.name);

  // In-memory cache: rawToken -> { account, expiresAt }
  private readonly tokenCache = new Map<string, { account: Mt5Account, expiresAt: number, lastUpdated: number }>();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache
  private readonly UPDATE_DEBOUNCE_MS = 60000; // Only update lastUsedAt once per minute

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a raw EA token (format: id.secret) and returns the associated Mt5Account
   */
  async validateEaToken(rawToken: string): Promise<Mt5Account> {
    if (!rawToken || !rawToken.includes('.')) {
      throw new UnauthorizedException('Invalid EA token format');
    }

    const now = Date.now();
    const cached = this.tokenCache.get(rawToken);

    if (cached && now < cached.expiresAt) {
      if (!cached.account.isActive) {
        this.tokenCache.delete(rawToken);
        throw new UnauthorizedException('Associated MT5 account is disabled');
      }

      // Debounce DB updates
      if (now - cached.lastUpdated > this.UPDATE_DEBOUNCE_MS) {
        cached.lastUpdated = now;
        this.updateLastUsed(rawToken.split('.')[0]);
      }
      return cached.account;
    }

    const [tokenId, secret] = rawToken.split('.');

    const eaTokenRecord = await this.prisma.eaToken.findUnique({
      where: { id: tokenId },
      include: { mt5Account: true },
    });

    if (!eaTokenRecord) {
      throw new UnauthorizedException('EA token not found');
    }

    if (eaTokenRecord.expiresAt && eaTokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('EA token expired');
    }

    const isSecretValid = await bcrypt.compare(secret, eaTokenRecord.tokenHash);
    if (!isSecretValid) {
      throw new UnauthorizedException('Invalid EA token secret');
    }

    if (!eaTokenRecord.mt5Account.isActive) {
      throw new UnauthorizedException('Associated MT5 account is disabled');
    }

    // Cache the successful validation
    this.tokenCache.set(rawToken, {
      account: eaTokenRecord.mt5Account,
      expiresAt: now + this.CACHE_TTL_MS,
      lastUpdated: now
    });

    this.updateLastUsed(tokenId);

    return eaTokenRecord.mt5Account;
  }

  private updateLastUsed(tokenId: string) {
    this.prisma.eaToken.update({
      where: { id: tokenId },
      data: { lastUsedAt: new Date() },
    }).catch((e: any) => this.logger.error(`Failed to update lastUsedAt for token ${tokenId}`, e.message));
  }
}
