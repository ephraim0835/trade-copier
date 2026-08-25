import { Controller, Patch, Param, Body, Post, Get, UseGuards, Request, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../services/accounts.service';
import { UpdateCopySettingsDto } from '../dto/update-copy-settings.dto';
import { UpdateTelemetryDto } from '../dto/update-telemetry.dto';
import { EaAuthGuard } from '../../ea-auth/ea-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../../database/prisma.service';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getAccounts(@Request() req: any) {
    return this.prisma.mt5Account.findMany({
      where: { userId: req.user.userId },
    });
  }

  @Patch(':accountId/settings')
  @UseGuards(AuthGuard('jwt'))
  async updateSettings(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateCopySettingsDto,
  ) {
    // Ownership check (IDOR protection)
    const account = await this.prisma.mt5Account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.userId !== req.user.userId) {
      throw new ForbiddenException('You do not have permission to modify this account');
    }

    return this.accountsService.updateCopySettings(accountId, dto);
  }

  @Post('telemetry')
  @UseGuards(EaAuthGuard)
  async updateTelemetry(
    @Request() req: any,
    @Body() dto: UpdateTelemetryDto,
  ) {
    const accountId = req.mt5Account.id;
    return this.accountsService.updateTelemetry(accountId, dto);
  }

  @Post('internal/ea-token')
  async generateEaToken(@Body() body: { accountId: string }, @Request() req: any) {
    const serviceKey = 'internal_manager_secret_998877';
    if (req.headers.authorization !== `Bearer ${serviceKey}`) {
      throw new ForbiddenException(`Invalid auth header: ${req.headers.authorization}`);
    }
    const crypto = require('crypto');
    const bcrypt = require('bcrypt');
    const secret = crypto.randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(secret, 10);
    const token = await this.prisma.eaToken.create({
      data: {
        mt5AccountId: body.accountId,
        tokenHash: hash,
      }
    });
    return { token: `${token.id}.${secret}` };
  }
}
