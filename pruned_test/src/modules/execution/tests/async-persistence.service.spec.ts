import { AsyncPersistenceService } from '../services/async-persistence.service';
import { PrismaService } from '../../../database/prisma.service';

describe('AsyncPersistenceService (Phase C Unit Tests)', () => {
  let service: AsyncPersistenceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          tradeSignal: { upsert: jest.fn().mockResolvedValue({}) },
          tradeCopy: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
          executionCommand: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return cb(tx);
      }),
      executionCommand: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      tradeSignal: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const mockRealtimeService = {
      emit: jest.fn(),
    };

    service = new AsyncPersistenceService(mockPrisma as any, mockRealtimeService as any);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should enqueue persistence tasks without throwing or blocking the caller', () => {
    expect(() => {
      service.enqueueTask('UPDATE_COMMAND_DELIVERED', { commandIds: ['cmd-1'], deliveredAt: new Date() });
      service.enqueueTask('UPDATE_COMMAND_ACK', { commandId: 'cmd-1', acknowledgedAt: new Date() });
    }).not.toThrow();

    expect(service.getQueueLength()).toBe(2);
  });

  it('should process queued tasks and invoke Prisma operations', async () => {
    service.enqueueTask('UPDATE_COMMAND_DELIVERED', { commandIds: ['cmd-1'], deliveredAt: new Date() });

    // Manually trigger private processQueue
    await (service as any).processQueue();

    expect(mockPrisma.executionCommand.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cmd-1'] } },
      data: expect.objectContaining({ status: 'DELIVERED' }),
    });
    expect(service.getQueueLength()).toBe(0);
  });

  it('should isolate DB errors without throwing back to callers', async () => {
    mockPrisma.executionCommand.update.mockRejectedValueOnce(new Error('Simulated DB network outage'));

    service.enqueueTask('UPDATE_COMMAND_ACK', { commandId: 'cmd-err', acknowledgedAt: new Date() });

    // Processing should catch the error, log warning, and not throw
    await expect((service as any).processQueue()).resolves.not.toThrow();
  });
});
