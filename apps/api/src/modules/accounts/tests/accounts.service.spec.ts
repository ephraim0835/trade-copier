import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../services/accounts.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { RealtimeService } from '../../realtime/realtime.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;
  let realtimeService: RealtimeService;
  
  const mockPrisma = {
    mt5Account: { findUnique: jest.fn(), update: jest.fn() },
    copySettings: { upsert: jest.fn() }
  };

  const mockRealtime = {
    emit: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeService, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get<PrismaService>(PrismaService);
    realtimeService = module.get<RealtimeService>(RealtimeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates missingSlTimeoutSec successfully', async () => {
    mockPrisma.mt5Account.findUnique.mockResolvedValue({ id: 'acc-1' });
    mockPrisma.copySettings.upsert.mockResolvedValue({ missingSlTimeoutSec: 120 });

    const result = await service.updateCopySettings('acc-1', { missingSlTimeoutSec: 120 });
    
    expect(mockPrisma.copySettings.upsert).toHaveBeenCalledWith({
      where: { mt5AccountId: 'acc-1' },
      update: { missingSlTimeoutSec: 120 },
      create: { mt5AccountId: 'acc-1', missingSlTimeoutSec: 120 }
    });
    expect(result.missingSlTimeoutSec).toBe(120);
  });

  it('rejects if account not found', async () => {
    mockPrisma.mt5Account.findUnique.mockResolvedValue(null);

    await expect(service.updateCopySettings('acc-invalid', { missingSlTimeoutSec: 120 }))
      .rejects.toThrow('Account not found');
  });

  it('updates telemetry successfully', async () => {
    mockPrisma.mt5Account.update.mockResolvedValue({ id: 'acc-1' });

    const result = await service.updateTelemetry('acc-1', {
      balance: 10000,
      equity: 10500,
      currency: 'USD'
    });

    expect(mockPrisma.mt5Account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: {
        balance: 10000,
        equity: 10500,
        margin: undefined,
        freeMargin: undefined,
        floatingPl: undefined,
        currency: 'USD'
      }
    });
    expect(result.success).toBe(true);
  });
});
