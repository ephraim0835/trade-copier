import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    
    // Fast path: skip logging for high-frequency execution hot paths
    if (originalUrl.includes('/execution/poll')) {
      return next();
    }

    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    req.headers['x-correlation-id'] = correlationId;

    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;
      const responseTime = Date.now() - startTime;

      this.logger.log(
        `[${correlationId}] ${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`
      );
    });

    next();
  }
}
