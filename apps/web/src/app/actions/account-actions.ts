'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { formatUserFriendlyError } from '@/lib/error-formatter';
import { getTrialGraceStatus, enforceTrialGraceCleanup } from '@/lib/trial-grace';

export async function createMt5Account(data: {
  login: string;
  broker: string;
  server: string;
  role: 'MASTER' | 'SUB';
  password?: string;
  isDemo?: boolean;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Automatically enforce 3-day grace period cleanup if expired
    await enforceTrialGraceCleanup(user.id);

    const trialGrace = getTrialGraceStatus(user);
    const isTrial = trialGrace.isTrial;
    if (!trialGrace.canConnectAccounts) {
      return { 
        success: false, 
        error: trialGrace.bannerMessage || 'Your 5-day free trial has expired. You cannot connect new accounts. Please select a plan on the Pricing page.',
        code: 'PAYWALL_REQUIRED'
      };
    }

    // Sanitize credentials to prevent newline injection (SEC-020)
    const cleanLogin = data.login.replace(/[\r\n]/g, '').trim();
    const cleanBroker = data.broker.replace(/[\r\n]/g, '').trim();
    const cleanServer = data.server.replace(/[\r\n]/g, '').trim();

    // Check if account with same login, broker, server already exists
    const existing = await prisma.mt5Account.findFirst({
      where: {
        login: cleanLogin,
        broker: cleanBroker,
        server: cleanServer,
      }
    });

    if (existing && existing.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return {
        success: false,
        error: `Account ${cleanLogin} on ${cleanServer} is already linked to another user account.`
      };
    }

    // Plan Limits Enforcement (Trial: 1/1, Starter: 1/3, Pro: 3/10, Elite: 5/25)
    const isOwnerOrAdmin = user.role === 'ADMIN' || user.role === 'OWNER' || user.subscription?.status === 'INTERNAL_FREE';
    if (!isOwnerOrAdmin) {
      const planId = (user.subscription?.planId || (isTrial ? 'trial' : 'starter')).toLowerCase();
      let maxMasters = 1;
      let maxSubs = 3;

      if (isTrial || planId === 'trial') {
        maxMasters = 1;
        maxSubs = 1;
      } else if (planId === 'pro') {
        maxMasters = 3;
        maxSubs = 10;
      } else if (planId === 'elite') {
        maxMasters = 5;
        maxSubs = 25;
      } else {
        // starter or legacy basic
        maxMasters = 1;
        maxSubs = 3;
      }

      const userAccounts = await prisma.mt5Account.findMany({
        where: { userId: user.id },
        select: { id: true, role: true }
      });

      const isReconnectingExisting = existing && existing.userId === user.id;
      const isSwitchingRole = Boolean(isReconnectingExisting && existing.role !== data.role);

      // Validate tier limits when creating new OR switching role on existing account (SEC-018)
      if (!isReconnectingExisting || isSwitchingRole) {
        const relevantAccounts = isSwitchingRole
          ? userAccounts.filter(a => a.id !== existing?.id)
          : userAccounts;

        if (data.role === 'MASTER') {
          const currentMasters = relevantAccounts.filter(a => a.role === 'MASTER').length;
          if (currentMasters >= maxMasters) {
            let limitMsg = '';
            if (isTrial || planId === 'trial') {
              limitMsg = 'Free Trial limit reached (maximum 1 Master account). Upgrade to Starter, Pro, or Elite to connect more Master accounts.';
            } else if (planId === 'starter' || planId === 'basic') {
              limitMsg = 'Starter Plan limit reached (maximum 1 Master account). Upgrade to Pro to connect up to 3 Master accounts.';
            } else if (planId === 'pro') {
              limitMsg = 'Pro Plan limit reached (maximum 3 Master accounts). Upgrade to Elite to connect up to 5 Master accounts.';
            } else {
              limitMsg = 'Elite Plan limit reached (maximum 5 Master accounts). Please contact support for custom institutional capacity.';
            }
            return {
              success: false,
              error: limitMsg,
              code: 'PLAN_LIMIT_REACHED'
            };
          }
        } else if (data.role === 'SUB') {
          const currentSubs = relevantAccounts.filter(a => a.role === 'SUB').length;
          if (currentSubs >= maxSubs) {
            let limitMsg = '';
            if (isTrial || planId === 'trial') {
              limitMsg = 'Free Trial limit reached (maximum 1 Sub account). Upgrade to Starter, Pro, or Elite to connect more Sub accounts.';
            } else if (planId === 'starter' || planId === 'basic') {
              limitMsg = 'Starter Plan limit reached (maximum 3 Sub accounts). Upgrade to Pro to connect up to 10 Sub accounts.';
            } else if (planId === 'pro') {
              limitMsg = 'Pro Plan limit reached (maximum 10 Sub accounts). Upgrade to Elite to connect up to 25 Sub accounts.';
            } else {
              limitMsg = 'Elite Plan limit reached (maximum 25 Sub accounts). Please contact support for custom institutional capacity.';
            }
            return {
              success: false,
              error: limitMsg,
              code: 'PLAN_LIMIT_REACHED'
            };
          }
        }
      }
    }

    const encryptedPassword = data.password ? encrypt(data.password) : undefined;

    let account;
    if (existing) {

      // Re-link & update existing account
      account = await prisma.mt5Account.update({
        where: { id: existing.id },
        data: {
          password: encryptedPassword !== undefined ? encryptedPassword : existing.password,
          role: data.role,
          isActive: true,
          isDemo: data.isDemo ?? existing.isDemo,
          connectionStatus: 'PENDING',
          provisioningError: null,
          updatedAt: new Date(),
        }
      });
    } else {
      account = await prisma.mt5Account.create({
        data: {
          userId: user.id,
          login: cleanLogin,
          password: encryptedPassword,
          broker: cleanBroker,
          server: cleanServer,
          role: data.role,
          isActive: true, // Auto-start the terminal upon creation
          isDemo: data.isDemo ?? true, // Default to demo for safety if not specified
          connectionStatus: 'PENDING',
          provisioningError: null,
        }
      });
    }

    // If it's a sub-account, ensure default copy settings and subscription exist
    if (data.role === 'SUB') {
      await prisma.copySettings.upsert({
        where: { mt5AccountId: account.id },
        update: {},
        create: {
          mt5AccountId: account.id,
          riskPercentage: 1.0,
        }
      });

      // Auto-subscribe to all active Master accounts of this user
      const userMasters = await prisma.mt5Account.findMany({
        where: { role: 'MASTER', userId: user.id }
      });
      
      for (const master of userMasters) {
        if (master.id !== account.id) {
          await prisma.accountSubscription.upsert({
            where: {
              masterAccountId_subAccountId: {
                masterAccountId: master.id,
                subAccountId: account.id,
              }
            },
            update: {
              isActive: true,
            },
            create: {
              masterAccountId: master.id,
              subAccountId: account.id,
              isActive: true,
            }
          });
        }
      }
    } else if (data.role === 'MASTER') {
      // Auto-subscribe all existing Sub accounts of this user to this master
      const userSubs = await prisma.mt5Account.findMany({
        where: { role: 'SUB', userId: user.id }
      });

      for (const sub of userSubs) {
        if (sub.id !== account.id) {
          await prisma.accountSubscription.upsert({
            where: {
              masterAccountId_subAccountId: {
                masterAccountId: account.id,
                subAccountId: sub.id,
              }
            },
            update: {
              isActive: true,
            },
            create: {
              masterAccountId: account.id,
              subAccountId: sub.id,
              isActive: true,
            }
          });
        }
      }
    }

    revalidatePath('/');
    revalidatePath('/master');
    revalidatePath('/risk');
    revalidatePath('/accounts');

    const { password, ...safeAccount } = account;
    return { success: true, account: safeAccount };
  } catch (error: any) {
    console.error('Error creating MT5 Account:', error);
    return { success: false, error: formatUserFriendlyError(error) };
  }
}

/**
 * Permanently delete an MT5 account (master or sub).
 * Only the owner of the account can delete it.
 */
export async function deleteAccount(accountId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized: Please log in again.' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    // Verify ownership or privileged role
    const isPrivileged = user.role === 'ADMIN' || user.role === 'OWNER';
    const account = await prisma.mt5Account.findFirst({
      where: isPrivileged ? { id: accountId } : { id: accountId, userId: user.id }
    });

    if (!account) {
      return { success: false, error: 'Account not found or access denied.' };
    }

    // Delete related records in dependency order to prevent foreign key errors
    await prisma.$transaction(async (tx) => {
      // 1. If it's a master account, fetch all TradeSignals generated by this account
      const signals = await tx.tradeSignal.findMany({
        where: { masterAcctId: accountId },
        select: { id: true },
      });
      const signalIds = signals.map((s) => s.id);

      // Find all trade copies belonging to this sub account OR to any signals of this master
      const copies = await tx.tradeCopy.findMany({
        where: {
          OR: [
            { subAccountId: accountId },
            ...(signalIds.length > 0 ? [{ signalId: { in: signalIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const copyIds = copies.map((c) => c.id);

      // 2. Delete AuditLogs (child of TradeCopy and/or Mt5Account)
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { subAccountId: accountId },
            ...(copyIds.length > 0 ? [{ tradeCopyId: { in: copyIds } }] : []),
          ],
        },
      });

      // 3. Delete ExecutionCommands (child of TradeCopy, Mt5Account, and/or TradeSignal)
      await tx.executionCommand.deleteMany({
        where: {
          OR: [
            { subAccountId: accountId },
            ...(copyIds.length > 0 ? [{ tradeCopyId: { in: copyIds } }] : []),
            ...(signalIds.length > 0 ? [{ masterSignalId: { in: signalIds } }] : []),
          ],
        },
      });

      // 4. Delete TradeCopies (safe now that AuditLogs and ExecutionCommands are deleted)
      if (copyIds.length > 0) {
        await tx.tradeCopy.deleteMany({
          where: { id: { in: copyIds } },
        });
      }

      // 5. Delete TradeSignals (safe now that child TradeCopies are deleted)
      if (signalIds.length > 0) {
        await tx.tradeSignal.deleteMany({
          where: { id: { in: signalIds } },
        });
      }

      // 6. Delete AccountSnapshots
      await tx.accountSnapshot.deleteMany({
        where: { mt5AccountId: accountId },
      });

      // 7. Delete EaTokens
      await tx.eaToken.deleteMany({
        where: { mt5AccountId: accountId },
      });

      // 8. Delete Orders, Deals, Positions
      await tx.order.deleteMany({
        where: { mt5AccountId: accountId },
      });
      await tx.deal.deleteMany({
        where: { mt5AccountId: accountId },
      });
      await tx.position.deleteMany({
        where: { mt5AccountId: accountId },
      });

      // 9. Delete CopySettings
      await tx.copySettings.deleteMany({
        where: { mt5AccountId: accountId },
      });

      // 10. Delete AccountSubscriptions (where this account is master or sub)
      await tx.accountSubscription.deleteMany({
        where: {
          OR: [
            { masterAccountId: accountId },
            { subAccountId: accountId },
          ],
        },
      });

      // 11. Finally delete the Mt5Account itself!
      await tx.mt5Account.delete({
        where: { id: accountId },
      });
    });

    // Notify VPS engine to immediately terminate the MT5 terminal for this deleted account
    try {
      await prisma.vpsEnvironment.updateMany({
        data: {
          lastCommand: 'SYNC',
          commandStatus: 'PENDING',
          commandAt: new Date(),
        },
      });
    } catch (cmdErr) {
      console.warn('Could not notify VPS environment:', cmdErr);
    }

    revalidatePath('/');
    revalidatePath('/master');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/risk');
    revalidatePath('/positions');
    revalidatePath('/performance');
    revalidatePath('/admin/users');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return { success: false, error: formatUserFriendlyError(error) };
  }
}

/**
 * Toggle the isActive flag on a sub account (enable/disable copying).
 */
export async function toggleAccountActive(accountId: string, isActive: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (isActive) {
      await enforceTrialGraceCleanup(user.id);
      const trialGrace = getTrialGraceStatus(user);
      if (!trialGrace.canCopyTrades) {
        return { 
          success: false, 
          error: trialGrace.bannerMessage || 'Your trial has expired. Please select a plan on the Pricing page to resume trade copying.',
          code: 'PAYWALL_REQUIRED'
        };
      }
    }

    // Verify ownership
    const account = await prisma.mt5Account.findFirst({
      where: { id: accountId, userId: user.id }
    });

    if (!account) {
      return { success: false, error: 'Account not found or access denied' };
    }

    await prisma.mt5Account.update({
      where: { id: accountId },
      data: { isActive }
    });

    try {
      await prisma.vpsEnvironment.updateMany({
        data: {
          lastCommand: 'SYNC',
          commandStatus: 'PENDING',
          commandAt: new Date(),
        },
      });
    } catch (cmdErr) {
      console.warn('Could not notify VPS environment:', cmdErr);
    }

    revalidatePath('/accounts');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling account active:', error);
    return { success: false, error: formatUserFriendlyError(error) };
  }
}

/**
 * Master Bot Switch: Pause or Resume trade copying across all user terminals.
 */
export async function toggleBotStatus(active: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (active) {
      await enforceTrialGraceCleanup(user.id);
      const trialGrace = getTrialGraceStatus(user);
      if (!trialGrace.canCopyTrades) {
        return { 
          success: false, 
          error: trialGrace.bannerMessage || 'Your trial has expired. Please select a plan on the Pricing page to resume trade copying.',
          code: 'PAYWALL_REQUIRED'
        };
      }
    }

    // 1. Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: { botStopped: !active },
    });

    // 2. Set all sub-accounts active state accordingly
    await prisma.mt5Account.updateMany({
      where: { userId: user.id, role: 'SUB' },
      data: { isActive: active },
    });

    // 3. Notify VPS engine immediately
    try {
      await prisma.vpsEnvironment.updateMany({
        data: {
          lastCommand: active ? 'RESUME' : 'PAUSE',
          commandStatus: 'PENDING',
          commandAt: new Date(),
        },
      });
    } catch (cmdErr) {
      console.warn('Could not notify VPS environment:', cmdErr);
    }

    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    revalidatePath('/master');

    return { success: true, botStopped: !active };
  } catch (error: any) {
    console.error('Error toggling bot status:', error);
    return { success: false, error: formatUserFriendlyError(error) };
  }
}

/**
 * Poll live connection & provisioning status for an MT5 account.
 */
export async function getAccountConnectionStatus(accountId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const account = await prisma.mt5Account.findFirst({
      where: { id: accountId, userId: user.id },
      select: {
        id: true,
        login: true,
        broker: true,
        server: true,
        role: true,
        connectionStatus: true,
        provisioningError: true,
        balance: true,
        equity: true,
        currency: true,
        lastHeartbeatAt: true,
        isActive: true,
      }
    });

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    return {
      success: true,
      account: {
        ...account,
        provisioningError: account.provisioningError ? formatUserFriendlyError(account.provisioningError) : null,
      }
    };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function retryAccountConnection(accountId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Automatically enforce 3-day grace period cleanup if expired
    await enforceTrialGraceCleanup(user.id);

    const trialGrace = getTrialGraceStatus(user);
    if (!trialGrace.canConnectAccounts && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return {
        success: false,
        error: trialGrace.bannerMessage || 'Your subscription or trial has expired. Please select a plan on the Pricing page to reconnect accounts.',
        code: 'PAYWALL_REQUIRED'
      };
    }

    const whereClause: any = { id: accountId };
    if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
      whereClause.userId = user.id;
    }

    await prisma.mt5Account.update({
      where: whereClause,
      data: {
        isActive: true,
        connectionStatus: 'PENDING',
        provisioningError: null,
        updatedAt: new Date(),
      }
    });

    // Notify VPS daemon to instantly synchronize and reconnect terminal
    try {
      await prisma.vpsEnvironment.updateMany({
        where: { commandStatus: { not: 'PENDING' } },
        data: {
          lastCommand: 'SYNC',
          commandStatus: 'PENDING',
          commandAt: new Date(),
          commandMessage: `Instant reconnect requested for account ${accountId}`,
        }
      });
    } catch {
      // Non-fatal if VPS environment record is transitioning
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function updateAccountCredentials(data: {
  accountId: string;
  login?: string;
  server?: string;
  password?: string;
  isDemo?: boolean;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const account = await prisma.mt5Account.findFirst({
      where: { id: data.accountId, userId: user.id }
    });

    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const updateData: any = {
      connectionStatus: 'PENDING',
      provisioningError: null,
      updatedAt: new Date(),
    };

    if (data.login && data.login.trim()) {
      updateData.login = data.login.replace(/[\r\n]/g, '').trim();
    }
    if (data.server && data.server.trim()) {
      updateData.server = data.server.replace(/[\r\n]/g, '').trim();
    }
    if (data.password && data.password.trim()) {
      updateData.password = encrypt(data.password.trim());
    }
    if (data.isDemo !== undefined) {
      updateData.isDemo = data.isDemo;
    }

    await prisma.mt5Account.update({
      where: { id: account.id },
      data: updateData,
    });

    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/risk');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function updateAccountRiskSettings(
  accountId: string,
  data: {
    displayName?: string | null;
    riskType?: string;
    fixedLotSize?: number;
    lotMultiplier?: number;
    riskPercentage?: number;
    roundingTolerancePct?: number;
    dailyRiskEnabled?: boolean;
    maxDailyRisk?: number;
    maxTradesEnabled?: boolean;
    maxActiveTrades?: number;
    requireTp?: boolean;
    missingSlTimeoutSec?: number;
    maxRecoveryRRDegradation?: number;
    maxLotCap?: number | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized: Please log in again.' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const account = await prisma.mt5Account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return { success: false, error: 'Account not found.' };
    }

    if (account.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return { success: false, error: 'You do not have permission to modify this account.' };
    }

    const { displayName, ...copySettingsData } = data;

    if (displayName !== undefined) {
      await prisma.mt5Account.update({
        where: { id: accountId },
        data: { displayName: displayName ? String(displayName).trim() : null },
      });
    }

    const cleanData: any = {};
    if (copySettingsData.riskType !== undefined) {
      const allowed = ['FIXED_LOT', 'MULTIPLIER', 'RISK_PERCENT', 'EQUITY_PERCENT'];
      const rt = String(copySettingsData.riskType).toUpperCase();
      if (!allowed.includes(rt)) {
        return { success: false, error: 'Invalid risk calculation type.' };
      }
      cleanData.riskType = rt;
    }
    if (copySettingsData.fixedLotSize !== undefined) {
      const num = Number(copySettingsData.fixedLotSize);
      if (isNaN(num) || num < 0.01 || num > 100) {
        return { success: false, error: 'Fixed lot size must be between 0.01 and 100.0.' };
      }
      cleanData.fixedLotSize = num;
    }
    if (copySettingsData.lotMultiplier !== undefined) {
      const num = Number(copySettingsData.lotMultiplier);
      if (isNaN(num) || num < 0.01 || num > 50) {
        return { success: false, error: 'Lot multiplier must be between 0.01 and 50.0.' };
      }
      cleanData.lotMultiplier = num;
    }
    if (copySettingsData.riskPercentage !== undefined) {
      const num = Number(copySettingsData.riskPercentage);
      if (isNaN(num) || num < 0.01 || num > 100) {
        return { success: false, error: 'Risk percentage must be between 0.01% and 100%.' };
      }
      cleanData.riskPercentage = num;
    }
    if (copySettingsData.roundingTolerancePct !== undefined) {
      const num = Number(copySettingsData.roundingTolerancePct);
      if (!isNaN(num)) cleanData.roundingTolerancePct = Math.max(0, Math.min(100, num));
    }
    if (copySettingsData.dailyRiskEnabled !== undefined) cleanData.dailyRiskEnabled = Boolean(copySettingsData.dailyRiskEnabled);
    if (copySettingsData.maxDailyRisk !== undefined) {
      const num = Number(copySettingsData.maxDailyRisk);
      if (!isNaN(num)) cleanData.maxDailyRisk = Math.max(0, Math.min(100, num));
    }
    if (copySettingsData.maxTradesEnabled !== undefined) cleanData.maxTradesEnabled = Boolean(copySettingsData.maxTradesEnabled);
    if (copySettingsData.maxActiveTrades !== undefined) {
      const num = parseInt(String(copySettingsData.maxActiveTrades), 10);
      if (!isNaN(num)) cleanData.maxActiveTrades = Math.max(1, Math.min(500, num));
    }
    if (copySettingsData.requireTp !== undefined) cleanData.requireTp = Boolean(copySettingsData.requireTp);
    if (copySettingsData.missingSlTimeoutSec !== undefined) {
      const num = parseInt(String(copySettingsData.missingSlTimeoutSec), 10);
      if (!isNaN(num)) cleanData.missingSlTimeoutSec = Math.max(0, Math.min(3600, num));
    }
    if (copySettingsData.maxRecoveryRRDegradation !== undefined) {
      const num = Number(copySettingsData.maxRecoveryRRDegradation);
      if (!isNaN(num)) cleanData.maxRecoveryRRDegradation = Math.max(0, Math.min(100, num));
    }
    if (copySettingsData.maxLotCap !== undefined) {
      if (copySettingsData.maxLotCap === null || copySettingsData.maxLotCap === 0) {
        cleanData.maxLotCap = null;
      } else {
        const num = Number(copySettingsData.maxLotCap);
        if (!isNaN(num) && num > 0) cleanData.maxLotCap = Math.min(100, num);
      }
    }

    await prisma.copySettings.upsert({
      where: { mt5AccountId: accountId },
      update: cleanData,
      create: {
        mt5AccountId: accountId,
        ...cleanData,
      },
    });

    revalidatePath(`/accounts/${accountId}/settings`);
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/risk');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating account risk settings:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}


