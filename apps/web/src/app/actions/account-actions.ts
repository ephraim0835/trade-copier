'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

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

    const account = await prisma.mt5Account.create({
      data: {
        userId: user.id,
        login: data.login,
        password: encryptedPassword,
        broker: data.broker,
        server: data.server,
        role: data.role,
        isActive: false, // Starts offline until EA connects
        isDemo: data.isDemo ?? true, // Default to demo for safety if not specified
      }
    });

    // If it's a sub-account, we should create default copy settings and subscribe it
    if (data.role === 'SUB') {
      await prisma.copySettings.create({
        data: {
          mt5AccountId: account.id,
          riskPercentage: 1.0,
        }
      });

      // Auto-subscribe to the user's first Master account to prevent breakage until UI is built
      const firstMaster = await prisma.mt5Account.findFirst({
        where: { role: 'MASTER', userId: user.id }
      });
      
      if (firstMaster) {
        await prisma.accountSubscription.create({
          data: {
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

    return { success: true, account };
  } catch (error: any) {
    console.error('Error creating MT5 Account:', error);
    return { success: false, error: error.message };
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

    // Delete related records first to avoid foreign key constraint errors
    await prisma.$transaction([
      prisma.eaToken.deleteMany({ where: { mt5AccountId: accountId } }),
      prisma.order.deleteMany({ where: { mt5AccountId: accountId } }),
      prisma.deal.deleteMany({ where: { mt5AccountId: accountId } }),
      prisma.position.deleteMany({ where: { mt5AccountId: accountId } }),
      prisma.copySettings.deleteMany({ where: { mt5AccountId: accountId } }),
      prisma.tradeCopy.deleteMany({ where: { subAccountId: accountId } }),
      prisma.auditLog.deleteMany({ where: { subAccountId: accountId } }),
      prisma.executionCommand.deleteMany({ where: { subAccountId: accountId } }),
      prisma.accountSubscription.deleteMany({ 
        where: { 
          OR: [{ masterAccountId: accountId }, { subAccountId: accountId }] 
        } 
      }),
      prisma.mt5Account.delete({ where: { id: accountId } })
    ]);

    revalidatePath('/');
    revalidatePath('/master');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
  }
}
