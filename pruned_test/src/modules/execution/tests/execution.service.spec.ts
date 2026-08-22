import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from '../services/execution.service';
import { HotDispatchService, HotCommandData } from '../services/hot-dispatch.service';
import { AsyncPersistenceService } from '../services/async-persistence.service';
import { CommandStatus, CommandType, OrderType } from '@prisma/client';

describe('ExecutionService - Hot Path Suite', () => {
  let execService: ExecutionService;
  let hotDispatch: HotDispatchService;
  let asyncPersistence: AsyncPersistenceService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        HotDispatchService,
        {
          provide: AsyncPersistenceService,
          useValue: {
            enqueueTask: jest.fn(),
          },
        },
      ],
    }).compile();

    execService = module.get<ExecutionService>(ExecutionService);
    hotDispatch = module.get<HotDispatchService>(HotDispatchService);
    asyncPersistence = module.get<AsyncPersistenceService>(AsyncPersistenceService);
  });

  beforeEach(() => {
    hotDispatch.clearAllMemory();
    jest.clearAllMocks();
  });

  const createMockCmd = (id: string, subAccountId: string): HotCommandData => ({
    id,
    tradeCopyId: `tc-${id}`,
    subAccountId,
    masterAccountId: 'master-1',
    type: CommandType.OPEN_ORDER,
    status: CommandStatus.CREATED,
    symbol: 'EURUSD',
    orderType: OrderType.BUY,
    volume: 0.1,
    sequenceNumber: 1,
    hotPathCommandAvailableAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('A1: poll returns CREATED/QUEUED commands and marks them DELIVERED atomically with 0 DB queries', async () => {
    await hotDispatch.enqueueCommand(createMockCmd('cmd-1', 'sub-1'));

    const commands = await execService.getPendingCommands('sub-1');
    expect(commands.length).toBe(1);
    expect(commands[0].commandId).toBe('cmd-1');

    // Verify async persistence task enqueued
    expect(asyncPersistence.enqueueTask).toHaveBeenCalledWith(
      'UPDATE_COMMAND_DELIVERED',
      expect.objectContaining({ commandIds: ['cmd-1'] })
    );

    // Second poll returns empty
    const secondPoll = await execService.getPendingCommands('sub-1');
    expect(secondPoll.length).toBe(0);
  });

  it('B1: acknowledgeCommand transitions command to ACKNOWLEDGED', async () => {
    await hotDispatch.enqueueCommand(createMockCmd('cmd-ack', 'sub-1'));
    await execService.getPendingCommands('sub-1');

    await execService.acknowledgeCommand('sub-1', 'cmd-ack');

    const cmd = hotDispatch.getCommand('cmd-ack');
    expect(cmd?.status).toBe(CommandStatus.ACKNOWLEDGED);
    expect(asyncPersistence.enqueueTask).toHaveBeenCalledWith(
      'UPDATE_COMMAND_ACK',
      expect.objectContaining({ commandId: 'cmd-ack' })
    );
  });

  it('C1: processExecutionResult updates command to EXECUTED and enqueues async persistence', async () => {
    await hotDispatch.enqueueCommand(createMockCmd('cmd-res', 'sub-1'));
    await execService.getPendingCommands('sub-1');
    await execService.acknowledgeCommand('sub-1', 'cmd-res');

    await execService.processExecutionResult('sub-1', {
      commandId: 'cmd-res',
      success: true,
      retcode: 10009,
      orderTicket: '987654',
      dealTicket: '123456',
      executedVolume: 0.1,
      executedPrice: 1.055,
      timestamp: new Date().toISOString(),
    });

    const cmd = hotDispatch.getCommand('cmd-res');
    expect(cmd?.status).toBe(CommandStatus.EXECUTED);
    expect(asyncPersistence.enqueueTask).toHaveBeenCalledWith(
      'UPDATE_COMMAND_RESULT',
      expect.objectContaining({ result: expect.objectContaining({ orderTicket: '987654' }) })
    );
  });
});
