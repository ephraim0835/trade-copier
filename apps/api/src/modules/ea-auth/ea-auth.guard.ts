import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { EaAuthService } from './ea-auth.service';

@Injectable()
export class EaAuthGuard implements CanActivate {
  private readonly logger = new Logger(EaAuthGuard.name);
  private readonly demoOnly: boolean;

  constructor(
    private readonly eaAuthService: EaAuthService,
    private readonly configService: ConfigService,
  ) {
    this.demoOnly = this.configService.get<string>('DEMO_ONLY') === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid Authorization header');
      throw new UnauthorizedException('Missing or invalid Bearer token');
    }

    const rawToken = authHeader.substring(7);

    try {
      const mt5Account = await this.eaAuthService.validateEaToken(rawToken);

      // When DEMO_ONLY=true, block all live (non-demo) account connections
      if (this.demoOnly && !mt5Account.isDemo) {
        this.logger.error(`SECURITY: DEMO_ONLY mode blocked live account ${mt5Account.id}`);
        throw new UnauthorizedException('DEMO_ONLY mode is active. Live connections are prohibited.');
      }

      // Inject the authenticated account into the request
      (request as any).mt5Account = mt5Account;
      return true;
    } catch (error) {
      this.logger.warn(`EA Auth failed: ${error.message}`);
      throw error;
    }
  }
}
