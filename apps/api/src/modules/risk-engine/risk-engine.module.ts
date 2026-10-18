import { Module } from '@nestjs/common';
import { RiskEngineService } from './services/risk-engine.service';
import { CurrencyService } from './services/currency.service';

@Module({
  providers: [RiskEngineService, CurrencyService],
  exports: [RiskEngineService, CurrencyService],
})
export class RiskEngineModule {}
