import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

import { ExecutionRepository } from './repositories/execution.repository';
import { ReconciliationRepository } from './repositories/reconciliation.repository';

@Global()
@Module({
  providers: [PrismaService, ExecutionRepository, ReconciliationRepository],
  exports: [PrismaService, ExecutionRepository, ReconciliationRepository],
})
export class DatabaseModule {}
