import { ExecutionService } from '../services/execution.service';
import { MasterSignalService } from '../services/master-signal.service';
import { HotDispatchService } from '../services/hot-dispatch.service';
import { CopyState } from '@prisma/client';
import { CommandStatus } from '@prisma/client';

describe('Failure Matrix & Idempotency', () => {
  let hotDispatch: HotDispatchService;
  let masterSignal: MasterSignalService;
  let executionService: ExecutionService;

  beforeEach(async () => {
    hotDispatch = new HotDispatchService();
    hotDispatch.disableJournaling = true;
    await hotDispatch.onModuleInit();
    
    const mockPrisma = {
      accountSubscription: {
        findMany: jest.fn().mockResolvedValue([{ masterAccountId: 'master-1', subAccountId: 'sub-1', isActive: true, subAccount: { id: 'sub-1', isDemo: true, isActive: true, copySettings: { riskPercentage: 1 } } }])
      },
      tradeSignal: { upsert: jest.fn(), update: jest.fn() },
      tradeCopy: { createMany: jest.fn(), update: jest.fn() },
      executionCommand: { createMany: jest.fn() },
      $transaction: jest.fn(async (cb) => cb({}))
    } as any;
    
    const mockRiskEngine = {
      evaluateTrade: jest.fn().mockReturnValue({ state: CopyState.APPROVED, executedVol: 0.1 })
    } as any;

    masterSignal = new MasterSignalService(mockPrisma, mockRiskEngine, hotDispatch, { enqueueTask: jest.fn() } as any, { get: jest.fn() } as any);
    await masterSignal.onModuleInit();
    
    executionService = new ExecutionService(hotDispatch, { enqueueTask: jest.fn() } as any);
  });

  it('1. Duplicate Master Event Delivery (Idempotency)', async () => {
    const dto = { eventId: 'ev-1', eventType: 'OPEN_ORDER', ticket: 1001, symbol: 'EURUSD', type: 'BUY', volume: 1.0, price: 1.1, time: new Date(), sequenceNumber: 1 };
    
    // First delivery
    await masterSignal.processOpen('master-1', dto as any, Date.now());
    let cmds = hotDispatch.getAllCommands();
    expect(cmds.length).toBe(1);
    
    // Second delivery (duplicate)
    await masterSignal.processOpen('master-1', dto as any, Date.now());
    cmds = hotDispatch.getAllCommands();
    expect(cmds.length).toBe(1); // Should still be exactly 1
  });

  it('2. Duplicate Sub Command Delivery (Multiple Polls)', async () => {
    const dto = { eventId: 'ev-2', eventType: 'OPEN_ORDER', ticket: 1002, symbol: 'EURUSD', type: 'BUY', volume: 1.0, price: 1.1, time: new Date(), sequenceNumber: 1 };
    await masterSignal.processOpen('master-1', dto as any, Date.now());
    
    // Sub EA Polls
    const firstPoll = await executionService.getPendingCommands('sub-1') as any[];
    expect(firstPoll.length).toBe(1);
    const cmdState = hotDispatch.getCommand(firstPoll[0].commandId);
    expect(cmdState?.status).toBe(CommandStatus.DELIVERED);
    
    // Sub EA Polls Again (e.g. network retry before ACK)
    const secondPoll = await executionService.getPendingCommands('sub-1') as any[];
    expect(secondPoll.length).toBe(0); // Cannot claim a DELIVERED command twice!
  });

  it('3. Duplicate Execution Result (Idempotency)', async () => {
    const dto = { eventId: 'ev-3', eventType: 'OPEN_ORDER', ticket: 1003, symbol: 'EURUSD', type: 'BUY', volume: 1.0, price: 1.1, time: new Date(), sequenceNumber: 1 };
    await masterSignal.processOpen('master-1', dto as any, Date.now());
    const [cmd] = await executionService.getPendingCommands('sub-1') as any[];
    
    // EA sends first result
    await executionService.processExecutionResult('sub-1', { commandId: cmd.commandId, success: true, retcode: 10009 } as any);
    let updatedCmd = hotDispatch.getCommand(cmd.commandId);
    expect(updatedCmd?.status).toBe(CommandStatus.EXECUTED);
    
    // EA sends duplicate result (e.g. network retry)
    await executionService.processExecutionResult('sub-1', { commandId: cmd.commandId, success: false, retcode: 10004 } as any);
    updatedCmd = hotDispatch.getCommand(cmd.commandId);
    expect(updatedCmd?.status).toBe(CommandStatus.EXECUTED); // Ignored
    expect(updatedCmd?.mt5Retcode).toBe(10009); // Retained original
  });

  it('4. EA Crash Window (Executed but history unwritten)', async () => {
    // Scenario: MT5 executes successfully -> EA crashes before writing history or sending /result
    const dto = { eventId: 'ev-4', eventType: 'OPEN_ORDER', ticket: 1004, symbol: 'EURUSD', type: 'BUY', volume: 1.0, price: 1.1, time: new Date(), sequenceNumber: 1 };
    await masterSignal.processOpen('master-1', dto as any, Date.now());
    
    // 1. Sub EA Polls & Claims the command
    const [cmd] = await executionService.getPendingCommands('sub-1') as any[];
    expect(cmd).toBeDefined();
    
    // 2. EA Sends ACK (Optional step, backend now marks it ACKNOWLEDGED)
    await executionService.acknowledgeCommand('sub-1', cmd.commandId);
    expect(hotDispatch.getCommand(cmd.commandId)?.status).toBe(CommandStatus.ACKNOWLEDGED);
    
    // 3. CRASH HAPPENS HERE. 
    // Backend never receives /result.
    // Simulate backend timeout sweeper (timeoutThresholdMs is usually 60s, we mock it by modifying date)
    const rawCmd = hotDispatch.getCommand(cmd.commandId);
    if (rawCmd) {
        rawCmd.deliveredAt = new Date(Date.now() - 120000); // 2 minutes ago
    }
    
    // Mock the replay/sweeper transitioning it to EXECUTION_UNKNOWN
    hotDispatch.markExecutionUnknown(cmd.commandId, 'Timeout simulated');
    expect(hotDispatch.getCommand(cmd.commandId)?.status).toBe(CommandStatus.EXECUTION_UNKNOWN);
    
    // 4. EA Restarts and Polls again
    // The backend MUST NOT redeliver this command!
    const repoll = await executionService.getPendingCommands('sub-1');
    expect(repoll.length).toBe(0); // Proves the backend never re-delivers an in-flight/unknown command
  });
});
