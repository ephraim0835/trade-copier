import { Controller, Get, Post, Query, UseGuards, Request, Body, Sse, UnauthorizedException, BadRequestException, MessageEvent } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Generates a short-lived, single-use ticket for establishing an SSE connection.
   * Requires a valid JWT Bearer token in the Authorization header.
   */
  @Post('ticket')
  @UseGuards(AuthGuard('jwt'))
  getTicket(@Request() req: any) {
    const userId = req.user.userId;
    const ticket = this.realtimeService.generateTicket(userId);
    return { ticket };
  }

  /**
   * Internal ticket endpoint for trusted internal services (e.g. Next.js server session proxy).
   * Authenticated via INTERNAL_MANAGER_SECRET.
   */
  @Post('internal/ticket')
  getInternalTicket(@Body() body: { userId: string }, @Request() req: any) {
    const serviceKey = process.env.INTERNAL_MANAGER_SECRET || 'internal_manager_secret_998877';
    const authHeader = req.headers?.authorization;
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      throw new UnauthorizedException('Invalid internal service authorization');
    }
    if (!body?.userId) {
      throw new BadRequestException('userId is required');
    }
    const ticket = this.realtimeService.generateTicket(body.userId);
    return { ticket };
  }

  /**
   * Establishes the SSE stream using the single-use ticket.
   * Does NOT accept JWT directly to prevent token leakage in URL.
   */
  @Sse('stream')
  stream(@Query('ticket') ticketId: string): Observable<MessageEvent> {
    if (!ticketId) {
      throw new UnauthorizedException('Missing ticket');
    }

    const userId = this.realtimeService.consumeTicket(ticketId);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired ticket');
    }

    // Now authenticated as `userId`. We only send events belonging to this user.
    return this.realtimeService.getStreamForUser(userId);
  }
}
