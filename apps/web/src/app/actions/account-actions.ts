'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import { formatUserFriendlyError } from '@/lib/error-formatter';

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

    const hasActiveSubscription = user.role === 'ADMIN' ||
      user.role === 'OWNER' ||
      (user.subscription && ['ACTIVE', 'TRIAL', 'INTERNAL_FREE'].includes(user.subscription.status));

    if (!hasActiveSubscription) {
      return { success: false, error: 'Active subscription required' };
    }

    const encryptedPassword = data.password ? encrypt(data.password) : undefined;

    // Check if account with same login, broker, server already exists
    const existing = await prisma.mt5Account.findFirst({
      where: {
        login: data.login,
        broker: data.broker,
        server: data.server,
      }
    });

    let account;
    if (existing) {
      if (existing.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
        return {
          success: false,
          error: `Account ${data.login} on ${data.server} is already linked to another user account.`
        };
      }

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
          login: data.login,
          password: encryptedPassword,
          broker: data.broker,
          server: data.server,
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

      // Auto-subscribe to the user's first Master account to prevent breakage until UI is built
      const firstMaster = await prisma.mt5Account.findFirst({
        where: { role: 'MASTER', userId: user.id }
      });
      
      if (firstMaster && firstMaster.id !== account.id) {
        await prisma.accountSubscription.upsert({
          where: {
            masterAccountId_subAccountId: {
              masterAccountId: firstMaster.id,
              subAccountId: account.id,
            }
          },
          update: {
            isActive: true,
          },
          create: {
            masterAccountId: firstMaster.id,
            subAccountId: account.id,
            isActive: true,
          }
        });
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
      where: { email: session.user.email }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
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

    revalidatePath('/accounts');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling account active:', error);
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
      where: { email: session.user.email }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await prisma.mt5Account.update({
      where: { id: accountId, userId: user.id },
      data: {
        connectionStatus: 'PENDING',
        provisioningError: null,
        updatedAt: new Date(),
      }
    });

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
      updateData.login = data.login.trim();
    }
    if (data.server && data.server.trim()) {
      updateData.server = data.server.trim();
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
    riskPercentage?: number;
    roundingTolerancePct?: number;
    dailyRiskEnabled?: boolean;
    maxDailyRisk?: number;
    maxTradesEnabled?: boolean;
    maxActiveTrades?: number;
    requireTp?: boolean;
    missingSlTimeoutSec?: number;
    maxRecoveryRRDegradation?: number;
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
    if (copySettingsData.riskPercentage !== undefined) cleanData.riskPercentage = Number(copySettingsData.riskPercentage);
    if (copySettingsData.roundingTolerancePct !== undefined) cleanData.roundingTolerancePct = Number(copySettingsData.roundingTolerancePct);
    if (copySettingsData.dailyRiskEnabled !== undefined) cleanData.dailyRiskEnabled = Boolean(copySettingsData.dailyRiskEnabled);
    if (copySettingsData.maxDailyRisk !== undefined) cleanData.maxDailyRisk = Number(copySettingsData.maxDailyRisk);
    if (copySettingsData.maxTradesEnabled !== undefined) cleanData.maxTradesEnabled = Boolean(copySettingsData.maxTradesEnabled);
    if (copySettingsData.maxActiveTrades !== undefined) cleanData.maxActiveTrades = Number(copySettingsData.maxActiveTrades);
    if (copySettingsData.requireTp !== undefined) cleanData.requireTp = Boolean(copySettingsData.requireTp);
    if (copySettingsData.missingSlTimeoutSec !== undefined) cleanData.missingSlTimeoutSec = Number(copySettingsData.missingSlTimeoutSec);
    if (copySettingsData.maxRecoveryRRDegradation !== undefined) cleanData.maxRecoveryRRDegradation = Number(copySettingsData.maxRecoveryRRDegradation);

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


