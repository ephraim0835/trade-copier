import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { AccountsService } from './services/accounts.service';
import { DatabaseModule } from '../../database/database.module';

import { EaAuthModule } from '../ea-auth/ea-auth.module';

@Module({
  imports: [DatabaseModule, EaAuthModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
