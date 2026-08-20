import { Module } from '@nestjs/common';
import { ExecutionController } from './controllers/execution.controller';
import { MasterSignalController } from './controllers/master-signal.controller';
import { ExecutionService } from './services/execution.service';
import { ReconciliationService } from './services/reconciliation.service';
import { MasterSignalService } from './services/master-signal.service';
import { HotDispatchService } from './services/hot-dispatch.service';
import { AsyncPersistenceService } from './services/async-persistence.service';
import { DatabaseModule } from '../../database/database.module';
import { RiskEngineModule } from '../risk-engine/risk-engine.module';
import { EaAuthModule } from '../ea-auth/ea-auth.module';

@Module({
  imports: [DatabaseModule, RiskEngineModule, EaAuthModule],
  controllers: [ExecutionController, MasterSignalController],
  providers: [
    ExecutionService,
    ReconciliationService,
    MasterSignalService,
    HotDispatchService,
    AsyncPersistenceService,
  ],
  exports: [
    ExecutionService,
    ReconciliationService,
    MasterSignalService,
    HotDispatchService,
    AsyncPersistenceService,
  ],
})
export class ExecutionModule {}
