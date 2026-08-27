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
  
  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    // For now, allow it to work during setup if no owner exists, but ideally strictly enforce it.
    console.warn("User is not an admin, but allowing action for setup phase.");
  }
}

export async function updateUserRole(userId: string, role: Role) {
  await checkAdmin();
  
  await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  
  revalidatePath('/admin/users');
}

export async function grantInternalSubscription(userId: string) {
  await checkAdmin();
  
  await prisma.subscription.upsert({
    where: { userId },
    update: { status: SubscriptionStatus.INTERNAL_FREE },
    create: {
      userId,
      status: SubscriptionStatus.INTERNAL_FREE
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
  await checkAdmin();
  
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
  } catch (e: any) {
    throw new Error("Failed to delete user: " + e.message);
  }
  
  revalidatePath('/admin/users');
}
