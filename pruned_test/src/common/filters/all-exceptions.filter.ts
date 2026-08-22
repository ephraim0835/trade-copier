import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Fallback to 500 if the exception is not an HttpException
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get correlation id if exists, or generate one
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();

    // Safe error message for the client
    let clientMessage = 'Internal server error';
    
    if (exception instanceof HttpException) {
      const responseMessage = exception.getResponse();
      if (typeof responseMessage === 'string') {
        clientMessage = responseMessage;
      } else if (typeof responseMessage === 'object' && responseMessage !== null) {
        clientMessage = (responseMessage as any).message || 'Http Error';
      }
    }

    // Prepare full error for internal logging (including stack traces)
    const errorLog = {
      correlationId,
      path: request.url,
      method: request.method,
      statusCode: status,
      error: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    // Log the error internally
    if (status >= 500) {
      this.logger.error(`[${correlationId}] ${request.method} ${request.url} - ${status}`, errorLog.stack);
    } else {
      this.logger.warn(`[${correlationId}] ${request.method} ${request.url} - ${status} - ${clientMessage}`);
    }

    // Send safe response to client
    response.status(status).json({
      statusCode: status,
      message: clientMessage,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
