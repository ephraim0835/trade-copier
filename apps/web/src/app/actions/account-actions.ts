'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { encrypt } from '@/lib/encryption';

export async function createMt5Account(data: {
  login: string;
  broker: string;
  server: string;
  role: 'MASTER' | 'SUB';
  password?: string;
}) {
  try {
    // We assume the user is the only user for now (or fetch the first user)
    // In a real app with auth, you would get the user ID from the session
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'admin@plaiz.com',
          password: 'mock_password',
          role: 'ADMIN'
        }
      });
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
