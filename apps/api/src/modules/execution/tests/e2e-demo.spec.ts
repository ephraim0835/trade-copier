import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from '../services/execution.service';
import { HotDispatchService, HotCommandData } from '../services/hot-dispatch.service';
import { AsyncPersistenceService } from '../services/async-persistence.service';
import { CommandStatus, OrderType, CommandType } from '@prisma/client';

describe('Phase 4: E2E Demo Simulation & Safety', () => {
  let execService: ExecutionService;
  let hotDispatch: HotDispatchService;

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
  });

  beforeEach(() => {
    hotDispatch.clearAllMemory();
  });

  it('Delivers command to Sub EA and handles ACK and result lifecycle', async () => {
    const cmd: HotCommandData = {
      id: 'cmd-e2e-1',
      tradeCopyId: 'tc-e2e-1',
      subAccountId: 'sub-demo-1',
      masterAccountId: 'master-1',
      type: CommandType.OPEN_ORDER,
      status: CommandStatus.CREATED,
      symbol: 'BTCUSDm',
      orderType: OrderType.BUY,
      volume: 0.1,
      sequenceNumber: 1,
      hotPathCommandAvailableAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await hotDispatch.enqueueCommand(cmd);

    // 1. Poll
    const polled = await execService.getPendingCommands('sub-demo-1');
    expect(polled.length).toBe(1);
    expect(polled[0].commandId).toBe('cmd-e2e-1');

    // 2. ACK
    await execService.acknowledgeCommand('sub-demo-1', 'cmd-e2e-1');
    expect(hotDispatch.getCommand('cmd-e2e-1')?.status).toBe(CommandStatus.ACKNOWLEDGED);

    // 3. Execution Result
    await execService.processExecutionResult('sub-demo-1', {
      commandId: 'cmd-e2e-1',
      success: true,
      retcode: 10009,
      orderTicket: '55555',
      dealTicket: '66666',
      executedVolume: 0.1,
      executedPrice: 64500,
      timestamp: new Date().toISOString(),
    });
    expect(hotDispatch.getCommand('cmd-e2e-1')?.status).toBe(CommandStatus.EXECUTED);
  });
});
