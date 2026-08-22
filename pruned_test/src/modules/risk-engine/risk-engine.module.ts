import { Module } from '@nestjs/common';
import { RiskEngineService } from './services/risk-engine.service';

@Module({
  providers: [RiskEngineService],
  exports: [RiskEngineService],
})
export class RiskEngineModule {}
