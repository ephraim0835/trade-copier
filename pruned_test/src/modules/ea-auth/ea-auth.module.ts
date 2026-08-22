import { Module } from '@nestjs/common';
import { EaAuthService } from './ea-auth.service';
import { EaAuthGuard } from './ea-auth.guard';

@Module({
  providers: [EaAuthService, EaAuthGuard],
  exports: [EaAuthService, EaAuthGuard],
})
export class EaAuthModule {}
