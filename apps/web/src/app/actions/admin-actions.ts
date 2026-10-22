"use server";

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role, SubscriptionStatus } from '@trade-copier/database';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");
  
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });
  
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.OWNER)) {
    throw new Error("Forbidden: Admin privileges required.");
  }

  return user;
}

export async function updateUserRole(userId: string, role: Role) {
  const admin = await checkAdmin();
  
  if (admin.id === userId) {
    throw new Error("Forbidden: You cannot modify your own role.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });
  if (!targetUser) {
    throw new Error("User not found.");
  }

  // Only OWNER can alter roles to or from ADMIN and OWNER
  const isPrivilegedChange =
    targetUser.role === Role.ADMIN ||
    targetUser.role === Role.OWNER ||
    role === Role.ADMIN ||
    role === Role.OWNER;

  if (isPrivilegedChange && admin.role !== Role.OWNER) {
    throw new Error("Forbidden: Only an OWNER can grant or modify administrative roles.");
  }

  // Disallow demoting the last remaining OWNER
  if (targetUser.role === Role.OWNER && role !== Role.OWNER) {
    const ownerCount = await prisma.user.count({
      where: { role: Role.OWNER }
    });
    if (ownerCount <= 1) {
      throw new Error("Forbidden: Cannot demote the last remaining OWNER.");
    }
  }
  
  await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  
  revalidatePath('/admin/users');
}

export async function grantInternalSubscription(userId: string, planId: 'starter' | 'pro' | 'elite' = 'pro') {
  await checkAdmin();
  
  await prisma.subscription.upsert({
    where: { userId },
    update: { 
      status: SubscriptionStatus.INTERNAL_FREE,
      planId: planId,
    },
    create: {
      userId,
      status: SubscriptionStatus.INTERNAL_FREE,
      planId: planId,
    }
  });
  
  revalidatePath('/admin/users');
}

export async function revokeSubscription(userId: string) {
  await checkAdmin();
  
  await prisma.subscription.update({
    where: { userId },
    data: { status: SubscriptionStatus.CANCELED }
  });
  
  revalidatePath('/admin/users');
}

export async function deleteUser(userId: string) {
  const admin = await checkAdmin();
  
  if (admin.id === userId) {
    throw new Error("Forbidden: You cannot delete your own account from the admin panel.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });
  if (!targetUser) {
    throw new Error("User not found.");
  }

  // Disallow deleting an OWNER if it's the last OWNER
  if (targetUser.role === Role.OWNER) {
    const ownerCount = await prisma.user.count({
      where: { role: Role.OWNER }
    });
    if (ownerCount <= 1) {
      throw new Error("Forbidden: Cannot delete the last remaining OWNER.");
    }
  }

  // An ADMIN cannot delete an ADMIN or OWNER
  if ((targetUser.role === Role.ADMIN || targetUser.role === Role.OWNER) && admin.role !== Role.OWNER) {
    throw new Error("Forbidden: Only an OWNER can delete administrative accounts.");
  }
  
  // Note: Prisma needs cascading deletes enabled for this to work natively if there are relations.
  try {
    // Manually delete related records if no cascade is set
    await prisma.subscription.deleteMany({ where: { userId } });
    const accounts = await prisma.mt5Account.findMany({ where: { userId } });
    for (const acc of accounts) {
      await prisma.accountSubscription.deleteMany({ where: { masterAccountId: acc.id } });
      await prisma.accountSubscription.deleteMany({ where: { subAccountId: acc.id } });
      await prisma.tradeCopy.deleteMany({ where: { subAccountId: acc.id } });
      await prisma.executionCommand.deleteMany({ where: { subAccountId: acc.id } });
      await prisma.eaToken.deleteMany({ where: { mt5AccountId: acc.id } });
      await prisma.copySettings.deleteMany({ where: { mt5AccountId: acc.id } });
      await prisma.order.deleteMany({ where: { mt5AccountId: acc.id } });
      await prisma.deal.deleteMany({ where: { mt5AccountId: acc.id } });
      await prisma.position.deleteMany({ where: { mt5AccountId: acc.id } });
      await prisma.mt5Account.delete({ where: { id: acc.id } });
    }
    
    await prisma.user.delete({
      where: { id: userId }
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
  } catch (e: any) {
    throw new Error("Failed to delete user: " + e.message);
  }
  
  revalidatePath('/admin/users');
}
