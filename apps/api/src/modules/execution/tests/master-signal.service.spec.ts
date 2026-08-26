import { Test, TestingModule } from '@nestjs/testing';
import { MasterSignalService } from '../services/master-signal.service';
import { RiskEngineService } from '../../risk-engine/services/risk-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { HotDispatchService } from '../services/hot-dispatch.service';
import { AsyncPersistenceService } from '../services/async-persistence.service';
import { CommandType, CommandStatus, CopyState, OrderType } from '@prisma/client';

describe('MasterSignalService - Hot Path Suite', () => {
  let service: MasterSignalService;
  let riskEngine: RiskEngineService;
  let hotDispatch: HotDispatchService;
  let asyncPersistence: AsyncPersistenceService;

  const mockPrisma = {
    accountSubscription: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          masterAccountId: 'master-1',
          subAccountId: 'sub-1',
          isActive: true,
          riskPercentage: null,
          subAccount: {
            id: 'sub-1',
            isDemo: true,
            isActive: true,
            copySettings: {
              riskPercentage: 1.0,
              roundingTolerancePct: 5,
              dailyRiskEnabled: false,
              maxDailyRisk: 500,
              maxTradesEnabled: false,
              maxActiveTrades: 10,
              requireTp: false,
              missingSlTimeoutSec: 60,
              maxRecoveryRRDegradation: 0.5,
            },
          }
        },
      ]),
    },
    tradeSignal: { upsert: jest.fn(), update: jest.fn() },
    tradeCopy: { createMany: jest.fn(), update: jest.fn() },
    executionCommand: { createMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterSignalService,
        HotDispatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RiskEngineService, useValue: { evaluateTrade: jest.fn() } },
        {
          provide: AsyncPersistenceService,
          useValue: {
            enqueueTask: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MasterSignalService>(MasterSignalService);
    riskEngine = module.get<RiskEngineService>(RiskEngineService);
    hotDispatch = module.get<HotDispatchService>(HotDispatchService);
    hotDispatch.disableJournaling = true;
    asyncPersistence = module.get<AsyncPersistenceService>(AsyncPersistenceService);

    await service.onModuleInit();
  });

  beforeEach(() => {
    hotDispatch.clearAllMemory();
    jest.clearAllMocks();
  });

  afterAll(() => {
    service.onModuleDestroy();
  });

  it('processOpen enqueues command to HotDispatch and queues async persistence with 0 sync DB queries', async () => {
    (riskEngine.evaluateTrade as jest.Mock).mockReturnValue({
      state: CopyState.APPROVED,
      executedVol: 0.5,
    });

    const result = await service.processOpen(
      'master-1',
      {
        ticket: '10001',
        symbol: 'BTCUSDm',
        type: OrderType.BUY,
        volume: 0.5,
        priceOpen: 64500,
        sl: 64000,
        tp: 66000,
        sequenceNumber: 1,
      },
      Date.now()
    );

    expect(result.success).toBe(true);

    // Command must be available in hotDispatch immediately
    const queuedCmds = hotDispatch.claimPendingCommands('sub-1', 1);
    expect(queuedCmds.length).toBe(1);
    expect(queuedCmds[0].symbol).toBe('BTCUSDm');
    expect(queuedCmds[0].volume).toBe(0.5);

    // Async persistence task must be enqueued
    expect(asyncPersistence.enqueueTask).toHaveBeenCalledWith(
      'PERSIST_SIGNAL_AND_COMMANDS',
      expect.objectContaining({
        signalData: expect.objectContaining({ ticket: 10001n }),
      })
    );
  });

  it('processModify transitions WAITING_FOR_SL copy to APPROVED and enqueues OPEN_ORDER', async () => {
    // 1. Initial OPEN without SL -> WAITING_FOR_SL
    (riskEngine.evaluateTrade as jest.Mock).mockReturnValueOnce({
      state: CopyState.WAITING_FOR_SL,
      executedVol: 0,
    });

    await service.processOpen(
      'master-1',
      {
        ticket: '20002',
        symbol: 'BTCUSDm',
        type: OrderType.BUY,
        volume: 0.5,
        priceOpen: 64500,
        sl: 0,
        sequenceNumber: 1,
      },
      Date.now()
    );

    // No commands enqueued yet
    expect(hotDispatch.claimPendingCommands('sub-1', 1)).toEqual([]);

    // 2. Modify SL -> APPROVED
    (riskEngine.evaluateTrade as jest.Mock).mockReturnValueOnce({
      state: CopyState.APPROVED,
      executedVol: 0.5,
    });

    await service.processModify(
      'master-1',
      {
        ticket: '20002',
        sl: 64100,
        sequenceNumber: 2,
      },
      Date.now()
    );

    // Command must now be enqueued as OPEN_ORDER
    const claimed = hotDispatch.claimPendingCommands('sub-1', 1);
    expect(claimed.length).toBe(1);
    expect(claimed[0].type).toBe(CommandType.OPEN_ORDER);
    expect(claimed[0].sl).toBe(64100);
  });

  it('processTrigger preserves pending order native trigger without creating duplicate market order', async () => {
    // Simulate pending order exists
    (riskEngine.evaluateTrade as jest.Mock).mockReturnValue({
      state: CopyState.APPROVED,
      executedVol: 0.5,
    });

    await service.processOpen(
      'master-1',
      {
        ticket: '30003',
        symbol: 'BTCUSDm',
        type: OrderType.BUY_LIMIT,
        volume: 0.5,
        priceOpen: 64000,
        sl: 63500,
        sequenceNumber: 1,
      },
      Date.now()
    );

    const pendingCmd = hotDispatch.claimPendingCommands('sub-1', 1)[0];
    hotDispatch.recordExecutionResult('sub-1', {
      commandId: pendingCmd.id,
      success: true,
      orderTicket: 77777n,
      executedVolume: 0.5,
    });

    // Trigger arrives from Master
    const triggerResult = await service.processTrigger(
      'master-1',
      {
        orderTicket: '30003',
        positionTicket: '30004',
        sequenceNumber: 2,
      },
      Date.now()
    );

    expect(triggerResult.success).toBe(true);

    // Zero new market OPEN commands should be created!
    const afterTrigger = hotDispatch.claimPendingCommands('sub-1', 1);
    expect(afterTrigger).toEqual([]);
  });
});
