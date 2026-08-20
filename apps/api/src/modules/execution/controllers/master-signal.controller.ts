import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MasterSignalService } from '../services/master-signal.service';
import { MasterSignalDto, MasterModifyDto, MasterCloseDto, MasterTriggerDto } from '../dto/master-signal.dto';
import { EaAuthGuard } from '../../ea-auth/ea-auth.guard';

import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('master/signal')
@UseGuards(EaAuthGuard)
export class MasterSignalController {
  constructor(private readonly masterSignalService: MasterSignalService) {}

  @Post('open')
  async openSignal(
    @Request() req: any,
    @Body() dto: MasterSignalDto
  ) {
    const backendReceivedAt = Date.now();
    const masterAccountId = req.mt5Account.id;
    return this.masterSignalService.processOpen(masterAccountId, dto, backendReceivedAt);
  }

  @Post('modify')
  async modifySignal(
    @Request() req: any,
    @Body() dto: MasterModifyDto
  ) {
    const backendReceivedAt = Date.now();
    const masterAccountId = req.mt5Account.id;
    return this.masterSignalService.processModify(masterAccountId, dto, backendReceivedAt);
  }

  @Post('close')
  async closeSignal(
    @Request() req: any,
    @Body() dto: MasterCloseDto
  ) {
    const backendReceivedAt = Date.now();
    const masterAccountId = req.mt5Account.id;
    return this.masterSignalService.processClose(masterAccountId, dto, backendReceivedAt);
  }

  @Post('trigger')
  async triggerSignal(
    @Request() req: any,
    @Body() dto: MasterTriggerDto
  ) {
    const backendReceivedAt = Date.now();
    const masterAccountId = req.mt5Account.id;
    return this.masterSignalService.processTrigger(masterAccountId, dto, backendReceivedAt);
  }
}
