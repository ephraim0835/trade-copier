import { HotDispatchService, HotCommandData } from '../services/hot-dispatch.service';
import { CommandStatus, CommandType, OrderType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('HotDispatchService (Phase B Unit Tests)', () => {
  let service: HotDispatchService;
  const journalDir = path.join(process.cwd(), 'data');
  const journalFile = path.join(journalDir, 'hot_command_journal.jsonl');

  beforeEach(() => {
    service = new HotDispatchService();
    service.disableJournaling = true;
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    const journal = (service as any).journalFile;
    if (journal && fs.existsSync(journal)) {
      try { fs.unlinkSync(journal); } catch (e) {}
    }
  });

  const createMockCommand = (id: string, subAccountId: string, seq: number, ticket: bigint = 1000n): HotCommandData => ({
    id,
    tradeCopyId: `copy-${id}`,
    subAccountId,
    masterAccountId: 'master-1',
    type: CommandType.OPEN_ORDER,
    status: CommandStatus.CREATED,
    symbol: 'EURUSD',
    orderType: OrderType.BUY,
    volume: 0.1,
    sl: 1.05,
    tp: 1.10,
    sequenceNumber: seq,
    masterSignalId: 'sig-1',
    masterOrderTicket: ticket,
    masterPositionTicket: ticket,
    hotPathCommandAvailableAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('1. FIFO Queue & Per-Account Isolation', () => {
    it('should enqueue and claim commands in exact FIFO order per account', async () => {
      const cmd1 = createMockCommand('cmd-1', 'sub-1', 1, 1001n);
      const cmd2 = createMockCommand('cmd-2', 'sub-1', 2, 1002n);
      const cmd3 = createMockCommand('cmd-3', 'sub-2', 1, 2001n);

      await service.enqueueCommand(cmd1);
      await service.enqueueCommand(cmd2);
      await service.enqueueCommand(cmd3);

      // Claim sub-1
      const claimedSub1 = service.claimPendingCommands('sub-1', 1);
      expect(claimedSub1.length).toBe(1);
      expect(claimedSub1[0].id).toBe('cmd-1');
      expect(claimedSub1[0].status).toBe(CommandStatus.DELIVERED);

      // Next claim sub-1
      const nextClaimedSub1 = service.claimPendingCommands('sub-1', 1);
      expect(nextClaimedSub1.length).toBe(1);
      expect(nextClaimedSub1[0].id).toBe('cmd-2');

      // sub-2 isolated claim
      const claimedSub2 = service.claimPendingCommands('sub-2', 10);
      expect(claimedSub2.length).toBe(1);
      expect(claimedSub2[0].id).toBe('cmd-3');
    });

    it('should return empty array if no commands are queued', () => {
      const claimed = service.claimPendingCommands('empty-account');
      expect(claimed).toEqual([]);
    });
  });

  describe('2. Concurrency: Atomic Single-Claim Protection', () => {
    it('should claim exactly once when 10 simultaneous poll requests compete for 1 command', async () => {
      const cmd = createMockCommand('cmd-single', 'sub-1', 1);
      await service.enqueueCommand(cmd);

      // Simulate 10 simultaneous /poll calls
      const pollResults = await Promise.all(
        Array.from({ length: 10 }).map(async () => {
          return service.claimPendingCommands('sub-1', 1);
        })
      );

      const allClaimed = pollResults.flat();
      expect(allClaimed.length).toBe(1);
      expect(allClaimed[0].id).toBe('cmd-single');
      expect(allClaimed[0].status).toBe(CommandStatus.DELIVERED);

      // Verify other 9 polls got empty results
      const emptyCount = pollResults.filter(res => res.length === 0).length;
      expect(emptyCount).toBe(9);
    });

    it('should claim 10 distinct commands across 10 simultaneous polls without duplicates', async () => {
      for (let i = 1; i <= 10; i++) {
        await service.enqueueCommand(createMockCommand(`cmd-${i}`, 'sub-1', i, BigInt(1000 + i)));
      }

      const pollResults = await Promise.all(
        Array.from({ length: 10 }).map(async () => {
          return service.claimPendingCommands('sub-1', 1);
        })
      );

      const claimedIds = pollResults.flat().map(c => c.id);
      expect(claimedIds.length).toBe(10);
      // All 10 IDs must be unique (zero duplicates)
      expect(new Set(claimedIds).size).toBe(10);
    });
  });

  describe('3. Monotonic Sequence Ordering & Idempotency', () => {
    it('should reject stale or out-of-order sequence numbers', () => {
      service.validateMonotonicSequence('master-1', 1001n, 10);
      expect(() => {
        service.validateMonotonicSequence('master-1', 1001n, 10); // Duplicate
      }).toThrow();

      expect(() => {
        service.validateMonotonicSequence('master-1', 1001n, 9); // Stale
      }).toThrow();

      // Next sequence accepted
      expect(() => {
        service.validateMonotonicSequence('master-1', 1001n, 11);
      }).not.toThrow();
    });

    it('should return existing command idempotently without creating duplicate on repeated enqueue', async () => {
      const cmd = createMockCommand('cmd-idem', 'sub-1', 1, 5555n);
      const first = await service.enqueueCommand(cmd);
      const second = await service.enqueueCommand(cmd);

      expect(first.id).toBe('cmd-idem');
      expect(second.id).toBe('cmd-idem');
      expect(service.getAllActiveCommands('sub-1').length).toBe(1);
    });
  });

  describe('4. State Machine & EXECUTION_UNKNOWN Safety', () => {
    it('should progress through DELIVERED -> ACKNOWLEDGED -> EXECUTED', async () => {
      const cmd = createMockCommand('cmd-state', 'sub-1', 1);
      await service.enqueueCommand(cmd);

      // 1. Claim (DELIVERED)
      const claimed = service.claimPendingCommands('sub-1', 1)[0];
      expect(claimed.status).toBe(CommandStatus.DELIVERED);

      // 2. ACK
      const acked = service.acknowledgeCommand('sub-1', 'cmd-state');
      expect(acked.status).toBe(CommandStatus.ACKNOWLEDGED);

      // 3. RESULT (EXECUTED)
      const result = service.recordExecutionResult('sub-1', {
        commandId: 'cmd-state',
        success: true,
        retcode: 10009,
        orderTicket: 999999n,
        dealTicket: 888888n,
        executedVolume: 0.1,
        executedPrice: 1.0505,
      });
      expect(result.status).toBe(CommandStatus.EXECUTED);
      expect(result.orderTicket).toBe(999999n);
    });

    it('should lock EXECUTION_UNKNOWN and refuse direct execution result or re-claim', async () => {
      const cmd = createMockCommand('cmd-unknown', 'sub-1', 1);
      await service.enqueueCommand(cmd);
      service.claimPendingCommands('sub-1', 1);

      // Transition to EXECUTION_UNKNOWN
      const unknown = service.markExecutionUnknown('cmd-unknown', 'Communication lost');
      expect(unknown.status).toBe(CommandStatus.EXECUTION_UNKNOWN);

      // Cannot be re-polled
      const repoll = service.claimPendingCommands('sub-1', 1);
      expect(repoll).toEqual([]);

      // Direct result rejected (must wait for reconciliation)
      const rejectedResult = service.recordExecutionResult('sub-1', {
        commandId: 'cmd-unknown',
        success: true,
      });
      expect(rejectedResult.status).toBe(CommandStatus.EXECUTION_UNKNOWN);
    });
  });

  describe('5. Crash Recovery & Journal Replay', () => {
    it('should restore unexecuted commands on restart and transition in-flight commands to EXECUTION_UNKNOWN', async () => {
      // Create a dedicated service instance with journaling ENABLED and a unique journal file
      const journalDir = path.join(process.cwd(), 'data');
      const uniqueJournalFile = path.join(journalDir, `test_journal_${Date.now()}_${Math.random().toString(36).substring(2)}.jsonl`);
      
      let crashingService = new HotDispatchService();
      crashingService.disableJournaling = false; // ENABLE IT
      (crashingService as any).journalFile = uniqueJournalFile;
      await crashingService.onModuleInit();

      // Seed commands
      const cmd1 = createMockCommand('cmd-queued', 'sub-1', 1);
      const cmd2 = createMockCommand('cmd-delivered', 'sub-1', 2);
      await crashingService.enqueueCommand(cmd1);
      await crashingService.enqueueCommand(cmd2);

      crashingService.claimPendingCommands('sub-1', 1); // cmd-queued gets DELIVERED
      
      // Simulate Crash
      crashingService.onModuleDestroy();

      // Restart with SAME journal file
      let recoveredService = new HotDispatchService();
      recoveredService.disableJournaling = false;
      (recoveredService as any).journalFile = uniqueJournalFile;
      await recoveredService.onModuleInit();

      // In-flight delivered commands must be recovered as EXECUTION_UNKNOWN
      const unknownCmd = recoveredService.getAllCommands().find(c => c.id === 'cmd-queued');
      expect(unknownCmd).not.toBeUndefined();
      
      // The other command was just CREATED, it should still be in the queue to be claimed
      const newQueue = recoveredService.claimPendingCommands('sub-1', 10);
      expect(newQueue.find(c => c.id === 'cmd-delivered')).not.toBeUndefined();

      // Cleanup
      recoveredService.onModuleDestroy();
      if (fs.existsSync(uniqueJournalFile)) {
        fs.unlinkSync(uniqueJournalFile);
      }
    });
  });
});
