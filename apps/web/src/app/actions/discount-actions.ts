'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { formatUserFriendlyError } from '@/lib/error-formatter';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true }
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    throw new Error('Forbidden: Admin access required');
  }
}

export async function getDiscountCodes() {
  try {
    await requireAdmin();

    const codes = await prisma.discountCode.findMany({
      include: {
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, codes };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function createDiscountCode(data: {
  code: string;
  percentage: number;
  duration: 'FIRST_MONTH' | 'LIFETIME';
  validUntil?: string | null;
  maxUses?: number | null;
}) {
  try {
    await requireAdmin();

    const cleanCode = data.code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Discount code is required' };
    }

    if (data.percentage <= 0 || data.percentage > 100) {
      return { success: false, error: 'Percentage must be between 1 and 100' };
    }

    const existing = await prisma.discountCode.findUnique({
      where: { code: cleanCode }
    });

    if (existing) {
      return { success: false, error: 'A discount code with this name already exists' };
    }

    const discount = await prisma.discountCode.create({
      data: {
        code: cleanCode,
        percentage: Number(data.percentage),
        duration: data.duration,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        maxUses: data.maxUses ? Number(data.maxUses) : null,
        isActive: true,
      }
    });

    revalidatePath('/admin/discounts');
    return { success: true, discount };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function toggleDiscountCodeActive(id: string, isActive: boolean) {
  try {
    await requireAdmin();

    await prisma.discountCode.update({
      where: { id },
      data: { isActive }
    });

    revalidatePath('/admin/discounts');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function deleteDiscountCode(id: string) {
  try {
    await requireAdmin();

    await prisma.discountCode.delete({
      where: { id }
    });

    revalidatePath('/admin/discounts');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function getUsersWithDiscounts() {
  try {
    await requireAdmin();

    const subscriptions = await prisma.subscription.findMany({
      where: {
        discountCodeId: { not: null }
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, createdAt: true }
        },
        discountCode: true,
      },
      orderBy: { updatedAt: 'desc' }
    });

    return { success: true, subscriptions };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

/**
 * Schedule the removal of a user's Lifetime discount.
 * Rule: Gives the user 14 days to react and immediately creates a 14-day notice,
 * with scheduled 7-day prior reminder.
 */
export async function scheduleLifetimeDiscountRemoval(subscriptionId: string) {
  try {
    await requireAdmin();

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, discountCode: true }
    });

    if (!sub || !sub.discountCode) {
      return { success: false, error: 'Subscription or discount not found' };
    }

    const now = new Date();
    const removalDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    // 1. Update subscription with scheduled removal date & record notice timestamp
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        lifetimeDiscountScheduledRemovalAt: removalDate,
        lifetimeDiscountNoticeSentAt: now,
      }
    });

    // 2. Create in-app notification with 14-day reaction window
    await prisma.userNotification.create({
      data: {
        userId: sub.userId,
        title: 'Important: Notice of Lifetime Discount Removal (14 Days Remaining)',
        message: `Your promotional lifetime discount (${sub.discountCode.percentage}% off) is scheduled to end on ${removalDate.toLocaleDateString()}. You have 14 days to review your subscription terms. You will receive a reminder 7 days prior to removal.`,
        type: 'DISCOUNT_REMOVAL',
        scheduledFor: removalDate,
      }
    });

    revalidatePath('/admin/discounts');
    return { success: true, scheduledDate: removalDate };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

/**
 * Cancel a pending scheduled lifetime discount removal.
 */
export async function cancelLifetimeDiscountRemoval(subscriptionId: string) {
  try {
    await requireAdmin();

    const sub = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        lifetimeDiscountScheduledRemovalAt: null,
        lifetimeDiscountNoticeSentAt: null,
      },
      include: { user: true }
    });

    await prisma.userNotification.create({
      data: {
        userId: sub.userId,
        title: 'Update: Your Lifetime Discount Has Been Retained',
        message: 'The scheduled removal of your lifetime discount was cancelled. Your discount remains active.',
        type: 'INFO',
      }
    });

    revalidatePath('/admin/discounts');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatUserFriendlyError(err) };
  }
}
