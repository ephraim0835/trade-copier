import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeController } from '../realtime.controller';
import { RealtimeService } from '../realtime.service';
import { UnauthorizedException } from '@nestjs/common';
import { firstValueFrom, toArray, take } from 'rxjs';

describe('RealtimeModule (SSE)', () => {
  let controller: RealtimeController;
  let service: RealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [RealtimeService],
    }).compile();

    controller = module.get<RealtimeController>(RealtimeController);
    service = module.get<RealtimeService>(RealtimeService);
  });

  it('generates a single-use ticket and returns a stream', (done) => {
    const ticket = service.generateTicket('user-1');
    expect(ticket).toBeDefined();

    const stream$ = controller.stream(ticket);
    expect(stream$).toBeDefined();

    // The stream should not error on valid ticket
    stream$.pipe(take(1)).subscribe({
      next: (val) => {
        const data = val.data as any;
        expect(data.type).toBe('REFRESH');
        expect(data.count).toBe(1);
        done();
      }
    });

    // Emit event
    service.emit('user-1', 'REFRESH');
  });

  it('rejects an invalid or reused ticket', () => {
    const ticket = service.generateTicket('user-1');
    
    // First connection consumes ticket
    controller.stream(ticket);
    
    // Second connection with same ticket should throw Unauthorized
    expect(() => controller.stream(ticket)).toThrow(UnauthorizedException);
    expect(() => controller.stream('fake-ticket')).toThrow(UnauthorizedException);
  });

  it('isolates events per user', (done) => {
    const ticket1 = service.generateTicket('user-1');
    const ticket2 = service.generateTicket('user-2');

    const stream1$ = controller.stream(ticket1);
    const stream2$ = controller.stream(ticket2);

    let user1Received = false;
    let user2Received = false;

    stream1$.subscribe((val) => {
      user1Received = true;
      const data = val.data as any;
      expect(data.count).toBe(1); // Should only receive user-1 events
    });

    stream2$.subscribe((val) => {
      user2Received = true;
      const data = val.data as any;
      expect(data.count).toBe(2); // Should receive user-2 events (we emit 2)
    });

    service.emit('user-1', 'REFRESH');
    service.emit('user-2', 'REFRESH');
    service.emit('user-2', 'REFRESH');

    // Wait for bufferTime(500)
    setTimeout(() => {
      expect(user1Received).toBe(true);
      expect(user2Received).toBe(true);
      done();
    }, 600);
  });

  it('rejects an expired ticket', () => {
    const ticket = service.generateTicket('user-1');
    
    // forcefully expire
    const mockNow = Date.now() + 35000;
    jest.spyOn(Date, 'now').mockReturnValue(mockNow);

    expect(() => controller.stream(ticket)).toThrow(UnauthorizedException);
    jest.restoreAllMocks();
  });
});
