'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth/next';

import { encrypt } from '@/lib/encryption';

export async function createMt5Account(data: {
  login: string;
  broker: string;
  server: string;
  role: 'MASTER' | 'SUB';
  password?: string;
}) {
  try {
    const session = await getServerSession();
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
        isDemo: true,
      }
    });

    // If it's a sub-account, we should create default copy settings and subscribe it
    if (data.role === 'SUB') {
      await prisma.copySettings.create({
        data: {
          mt5AccountId: account.id,
          riskMultiplier: 1.0,
        }
      });

      // Temporarily auto-subscribe to the first Master account to prevent breakage until UI is built
      const firstMaster = await prisma.mt5Account.findFirst({
        where: { role: 'MASTER' }
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

    return { success: true, account };
  } catch (error: any) {
    console.error('Error creating MT5 Account:', error);
    return { success: false, error: error.message };
  }
}
