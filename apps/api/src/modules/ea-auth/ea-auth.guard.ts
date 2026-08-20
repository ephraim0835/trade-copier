import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { EaAuthService } from './ea-auth.service';

@Injectable()
export class EaAuthGuard implements CanActivate {
  private readonly logger = new Logger(EaAuthGuard.name);

  constructor(private readonly eaAuthService: EaAuthService) {}

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

      // Check DEMO_ONLY constraint
      if (!mt5Account.isDemo) {
        this.logger.error(`SECURITY VIOLATION: Attempted EA connection from non-demo account ${mt5Account.id}`);
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
