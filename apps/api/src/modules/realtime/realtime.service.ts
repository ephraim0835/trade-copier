import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, bufferTime, filter, map } from 'rxjs';
import * as crypto from 'crypto';

export interface SseEvent {
  userId: string;
  type: 'REFRESH';
  payload?: any;
}

interface SseTicket {
  userId: string;
  expiresAt: number;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventSubject = new Subject<SseEvent>();
  
  // In-memory ticket store: ticketId -> SseTicket
  // SECURITY NOTE: This in-memory map restricts the application to a single backend instance.
  // If deployed to a multi-instance architecture (e.g. Kubernetes with multiple replicas),
  // this ticket store and the event Subject MUST be replaced with a Redis-backed store and pub/sub mechanism
  // so that a ticket generated on Instance A can be validated on Instance B.
  private readonly tickets = new Map<string, SseTicket>();

  /**
   * Generates a single-use ticket for establishing an SSE connection.
   */
  generateTicket(userId: string): string {
    const ticketId = crypto.randomUUID();
    // 30-second expiry
    this.tickets.set(ticketId, {
      userId,
      expiresAt: Date.now() + 30000,
    });
    
    // Clean up expired tickets periodically or on generation to prevent memory leaks
    this.cleanupTickets();
    
    return ticketId;
  }

  /**
   * Consumes a ticket. Returns userId if valid, or null if invalid/expired.
   */
  consumeTicket(ticketId: string): string | null {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;
    
    this.tickets.delete(ticketId); // Single use
    
    if (Date.now() > ticket.expiresAt) {
      return null;
    }
    
    return ticket.userId;
  }

  private cleanupTickets() {
    const now = Date.now();
    for (const [id, ticket] of this.tickets.entries()) {
      if (now > ticket.expiresAt) {
        this.tickets.delete(id);
      }
    }
  }

  /**
   * Emits a realtime event intended for a specific user.
   */
  emit(userId: string, type: 'REFRESH', payload?: any) {
    this.eventSubject.next({ userId, type, payload });
  }

  /**
   * Returns an RxJS Observable batched (throttled) per 500ms for a specific user.
   */
  getStreamForUser(userId: string): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      filter(event => event.userId === userId),
      // Batch events every 50ms to provide near-instant real-time updates
      bufferTime(50),
      // Only emit if there's actually an event in the buffer
      filter(events => events.length > 0),
      map(events => {
        // Collect all payloads from the batched events
        const payloads = events.map(e => e.payload).filter(p => p !== undefined);
        return {
          data: {
            type: 'REFRESH',
            // Send timestamp of latest batch
            timestamp: Date.now(),
            count: events.length,
            payloads: payloads
          }
        } as MessageEvent;
      })
    );
  }
}
