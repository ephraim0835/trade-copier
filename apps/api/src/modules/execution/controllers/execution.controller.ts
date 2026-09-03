import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, HttpStatus } from '@nestjs/common';
import { ExecutionService } from '../services/execution.service';
import { ReconciliationService } from '../services/reconciliation.service';
import { AckDto } from '../dto/ack.dto';
import { ExecutionResultDto } from '../dto/execution-result.dto';
import { SyncStateDto } from '../dto/sync-state.dto';
import { EaAuthGuard } from '../../ea-auth/ea-auth.guard';
import { Response } from 'express';

import { SkipThrottle, Throttle } from '@nestjs/throttler';

@Controller('execution')
@UseGuards(EaAuthGuard)
export class ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly reconciliationService: ReconciliationService
  ) {}

  @Throttle({ default: { limit: 3000, ttl: 60000 } })
  @Get('poll')
  async pollCommands(@Request() req: any, @Res() res: Response) {
    const subAccountId = req.mt5Account.id;
    const commands = await this.executionService.getPendingCommands(subAccountId);
    
    if (commands.length === 0) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }
    
    return res.status(HttpStatus.OK).json({ commands });
  }

  @Post('ack')
  async acknowledgeCommand(
    @Request() req: any,
    @Body() ackDto: AckDto & { subAcknowledgedAt?: number, subReceivedAt?: number }
  ) {
    const subAccountId = req.mt5Account.id;
    if (!ackDto?.commandId) return { success: false, error: 'Missing commandId' };
    
    let subReceivedAt = null;
    let subAcknowledgedAt = null;
    if (ackDto.subAcknowledgedAt) {
      const now = Date.now();
      const t8Wait = ackDto.subReceivedAt ? (Number(ackDto.subAcknowledgedAt) - Number(ackDto.subReceivedAt)) / 1000 : 0;
      subAcknowledgedAt = new Date(now);
      subReceivedAt = new Date(now - (t8Wait * 1000));
    }
    
    await this.executionService.acknowledgeCommand(subAccountId, ackDto.commandId, {
      subReceivedAt,
      subAcknowledgedAt,
    });
    return { success: true };
  }

  @Post('result')
  async submitResult(
    @Request() req: any,
    @Body() resultDto: ExecutionResultDto
  ) {
    const subAccountId = req.mt5Account.id;
    await this.executionService.processExecutionResult(subAccountId, resultDto);
    return { success: true };
  }

  @Post('sync')
  async syncState(
    @Request() req: any,
    @Body() syncStateDto: SyncStateDto
  ) {
    const subAccountId = req.mt5Account.id;
    await this.reconciliationService.reconcileState(subAccountId, syncStateDto);
    return { success: true };
  }
}
