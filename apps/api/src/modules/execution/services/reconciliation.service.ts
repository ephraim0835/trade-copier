import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReconciliationRepository } from '../../../database/repositories/reconciliation.repository';
import { SyncStateDto } from '../dto/sync-state.dto';
import { CommandStatus, CopyState } from '@prisma/client';


@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly demoOnly: boolean;

  constructor(
    private reconciliationRepo: ReconciliationRepository,
    private readonly configService: ConfigService,
  ) {
    this.demoOnly = this.configService.get<string>('DEMO_ONLY') === 'true';
  }

  async reconcileState(subAccountId: string, state: SyncStateDto): Promise<void> {
    const account = await this.reconciliationRepo.getAccount(subAccountId);

    if (this.demoOnly && !account?.isDemo) {
      throw new Error(`DEMO_ONLY mode is active. Live execution sync is prohibited.`);
    }

    // Update real-time account stats
    if (state.balance != null && state.equity != null) {
      await this.reconciliationRepo.updateAccountStats(
        subAccountId,
        state.balance,
        state.equity,
        state.marginFree || 0
      );
      
      // Hourly Snapshot Logic / Baseline creation
      await this.reconciliationRepo.recordSnapshotIfDue(
        subAccountId,
        state.balance,
        state.equity,
        state.equity - state.balance
      );
    }

    // Phase 3 implementation: compare state against expected state

    // 1. Check for EXECUTION_UNKNOWN commands
    const unknownCommands = await this.reconciliationRepo.findUnknownCommands(subAccountId);

    for (const cmd of unknownCommands) {
      // Check if there is an order or position in the EA state that matches this command
      const foundOrder = state.orders.find(
        o => o.symbol === cmd.symbol && o.volume === cmd.volume && o.type === cmd.orderType
      );
      
      const foundPosition = state.positions.find(
        p => p.symbol === cmd.symbol && p.volume === cmd.volume 
      );

      // If we find a match, it executed successfully
      if (foundOrder || foundPosition) {
        this.logger.log(`Reconciliation resolved EXECUTION_UNKNOWN command ${cmd.id} -> EXECUTED`);
        
        const ticket = foundOrder ? foundOrder.ticket : foundPosition?.ticket;

        await this.reconciliationRepo.resolveUnknownCommand(
          cmd.id,
          cmd.tradeCopyId,
          ticket?.toString() || null,
          foundPosition ? foundPosition.ticket.toString() : null
        );
      } else {
        // Did not execute, we could mark as FAILED or leave as UNKNOWN for manual review
        // Rule: "If reconciliation cannot confidently determine the state: EXECUTION_UNKNOWN remains unresolved"
        this.logger.warn(`Reconciliation could not resolve EXECUTION_UNKNOWN command ${cmd.id}`);
      }
    }

    // 2. Check for native MT5 triggers and missing positions/orders
    const activeCopies = await this.reconciliationRepo.getActiveCopies(subAccountId);

    for (const copy of activeCopies) {
      if (copy.subOrderTicket && !copy.subPositionId) {
        // This is a Pending Order. Check if it triggered natively.
        const triggeredPosition = state.positions.find(p => p.identifier === copy.subOrderTicket?.toString());
        if (triggeredPosition) {
          this.logger.log(`[NATIVE_TRIGGER] Pending order ${copy.subOrderTicket} triggered into position ${triggeredPosition.ticket}`);
          await this.reconciliationRepo.mapNativeTrigger(copy.id, triggeredPosition.ticket);
          continue; // Successfully mapped
        }
        
        // If not triggered, ensure the order is still there
        const eaOrder = state.orders.find(o => o.ticket === copy.subOrderTicket?.toString());
        if (!eaOrder) {
          this.logger.warn(`[MISSING_ORDER] Expected pending order ${copy.subOrderTicket} on account ${subAccountId} but EA did not report it.`);
        }
      } else if (copy.subPositionId) {
        // This is a Position. Ensure it's still there.
        const eaPos = state.positions.find(p => p.ticket === copy.subPositionId?.toString());
        if (!eaPos) {
          this.logger.warn(`[MISSING_POSITION] Expected position ${copy.subPositionId} on account ${subAccountId} but EA did not report it.`);
        } else {
          // Compare volume
          if (copy.currentVolume && eaPos.volume !== copy.currentVolume) {
            this.logger.warn(`[VOLUME_DRIFT] Position ${copy.subPositionId}: Expected ${copy.currentVolume}, got ${eaPos.volume}`);
          }
        }
      }
    }

    // 3. Check for unexpected positions
    for (const eaPos of state.positions) {
      const isExpected = activeCopies.some(c => c.subPositionId?.toString() === eaPos.ticket || (eaPos.identifier && c.subOrderTicket?.toString() === eaPos.identifier));
      if (!isExpected) {
        this.logger.warn(`[UNEXPECTED_POSITION] Found position ${eaPos.ticket} on account ${subAccountId} not mapped in DB.`);
      }
    }
  }
}
