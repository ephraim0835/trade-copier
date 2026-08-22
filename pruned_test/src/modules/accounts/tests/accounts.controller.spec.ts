import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from '../controllers/accounts.controller';
import { AccountsService } from '../services/accounts.service';
import { PrismaService } from '../../../database/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EaAuthService } from '../../ea-auth/ea-auth.service';

describe('AccountsController (Authorization)', () => {
  let controller: AccountsController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: {
            updateCopySettings: jest.fn().mockResolvedValue({ id: 'settings-1' }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            mt5Account: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: EaAuthService,
          useValue: {},
        }
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('updateSettings (IDOR Protection)', () => {
    it('should throw NotFoundException if account does not exist', async () => {
      jest.spyOn(prismaService.mt5Account, 'findUnique').mockResolvedValue(null);
      
      const req = { user: { userId: 'user-1' } };
      await expect(controller.updateSettings(req, 'missing-id', {} as any))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user attempts to modify another users account (IDOR)', async () => {
      // Account belongs to user-2
      jest.spyOn(prismaService.mt5Account, 'findUnique').mockResolvedValue({
        id: 'acc-1',
        userId: 'user-2',
      } as any);
      
      // Requesting user is user-1
      const req = { user: { userId: 'user-1' } };
      
      await expect(controller.updateSettings(req, 'acc-1', {} as any))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should allow modification if account belongs to user', async () => {
      // Account belongs to user-1
      jest.spyOn(prismaService.mt5Account, 'findUnique').mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
      } as any);
      
      // Requesting user is user-1
      const req = { user: { userId: 'user-1' } };
      
      const result = await controller.updateSettings(req, 'acc-1', {} as any);
      expect(result).toEqual({ id: 'settings-1' });
    });
  });
});
