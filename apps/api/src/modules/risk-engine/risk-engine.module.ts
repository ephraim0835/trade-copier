import { Module } from '@nestjs/common';
import { RiskEngineService } from './services/risk-engine.service';
import { CurrencyService } from './services/currency.service';
import { LotCalculatorService } from './services/lot-calculator.service';

@Module({
  providers: [RiskEngineService, CurrencyService, LotCalculatorService],
  exports: [RiskEngineService, CurrencyService, LotCalculatorService],
})
export class RiskEngineModule {}
