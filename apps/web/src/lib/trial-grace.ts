import { prisma } from './prisma';

export interface TrialGraceStatus {
  isTrial: boolean;
  isPaidOrAdmin: boolean;
  isTrialExpired: boolean;
  trialEndsAt: Date | null;
  inGracePeriod: boolean;
  gracePeriodEndsAt: Date | null;
  graceHoursRemaining: number;
  graceDaysRemaining: number;
  isGraceExpired: boolean;
  canConnectAccounts: boolean;
  canCopyTrades: boolean;
  bannerTitle?: string;
  bannerMessage?: string;
}

/**
 * Adds business days (Monday through Friday) to a given start date,
 * strictly skipping Saturdays and Sundays.
 */
export function addBusinessDays(startDate: Date, numDays: number): Date {
  const result = new Date(startDate.getTime());
  let daysAdded = 0;
  while (daysAdded < numDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  return result;
}

/**
 * Calculates whether user is on trial, if trial expired,
 * and if they are within the 3-day grace period to select a plan.
 */
export function getTrialGraceStatus(user: {
  role?: string;
  subscription?: {
    status?: string;
    planId?: string | null;
    currentPeriodEnd?: Date | null;
  } | null;
}): TrialGraceStatus {
  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';
  const isInternalFree = user.subscription?.status === 'INTERNAL_FREE';
  const isActivePaid = user.subscription?.status === 'ACTIVE' && user.subscription?.planId !== 'trial';

  if (isAdmin || isInternalFree || isActivePaid) {
    return {
      isTrial: false,
      isPaidOrAdmin: true,
      isTrialExpired: false,
      trialEndsAt: null,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      graceHoursRemaining: 0,
      graceDaysRemaining: 0,
      isGraceExpired: false,
      canConnectAccounts: true,
      canCopyTrades: true,
    };
  }

  const isTrial = user.subscription?.status === 'TRIAL' || user.subscription?.planId === 'trial';
  const currentPeriodEnd = user.subscription?.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd) : null;
  const now = Date.now();

  if (!isTrial || !currentPeriodEnd) {
    const isExpiredStatus = user.subscription?.status === 'EXPIRED';
    return {
      isTrial: false,
      isPaidOrAdmin: false,
      isTrialExpired: true,
      trialEndsAt: null,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      graceHoursRemaining: 0,
      graceDaysRemaining: 0,
      isGraceExpired: true,
      canConnectAccounts: false,
      canCopyTrades: false,
      bannerTitle: isExpiredStatus ? 'Subscription Expired' : 'No Active Plan',
      bannerMessage: isExpiredStatus
        ? 'Your trial and 3-day grace period have ended. Connected accounts have been cleared. Select a plan to reconnect.'
        : 'An active plan is required to connect MT5 accounts and copy trades. Please select a plan.',
    };
  }

  const trialEndMs = currentPeriodEnd.getTime();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days = 72 Hours
  const graceEndMs = trialEndMs + THREE_DAYS_MS;
  const gracePeriodEndsAt = new Date(graceEndMs);

  const isTrialExpired = now > trialEndMs;
  const isGraceExpired = now > graceEndMs;
  const inGracePeriod = isTrialExpired && !isGraceExpired;

  const msRemaining = Math.max(0, graceEndMs - now);
  const graceHoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const graceDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  let bannerTitle: string | undefined;
  let bannerMessage: string | undefined;

  if (inGracePeriod) {
    const timeLabel = graceDaysRemaining > 1 ? `${graceDaysRemaining} days` : `${graceHoursRemaining} hours`;
    bannerTitle = `Trial Expired — 3-Day Grace Period (${timeLabel} remaining)`;
    bannerMessage = `Your 5-day free trial has expired. You have ${timeLabel} left in your 3-day grace period to select a plan. Trade copying is paused, and your existing connected MT5 accounts will be automatically cleared when this grace period ends.`;
  } else if (isGraceExpired) {
    bannerTitle = 'Trial & 3-Day Grace Period Expired';
    bannerMessage = 'Your 5-day trial and 3-day grace period have ended without a plan selection. Your connected accounts have been cleared. Please choose a plan on the Pricing page to reconnect.';
  }

  return {
    isTrial: true,
    isPaidOrAdmin: false,
    isTrialExpired,
    trialEndsAt: currentPeriodEnd,
    inGracePeriod,
    gracePeriodEndsAt,
    graceHoursRemaining,
    graceDaysRemaining,
    isGraceExpired,
    canConnectAccounts: !isTrialExpired, // Cannot connect new accounts once trial ends!
    canCopyTrades: !isTrialExpired, // Cannot copy trades once trial ends!
    bannerTitle,
    bannerMessage,
  };
}

/**
 * Enforces grace period expiration cleanup:
 * If a user's 3-day grace period has passed without picking a plan,
 * cleans up and deletes their connected accounts to release server/terminal resources.
 */
export async function enforceTrialGraceCleanup(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        accounts: {
          select: { id: true, login: true, server: true, broker: true }
        }
      }
    });

    if (!user) return;
    const status = getTrialGraceStatus(user);

    if (status.isGraceExpired && user.accounts.length > 0) {
      console.log(`[GracePeriod] Clearing ${user.accounts.length} accounts for user ${userId} whose 3-day grace period expired.`);

      // 1. Delete account subscriptions linking
      await prisma.accountSubscription.deleteMany({
        where: {
          OR: [
            { masterAccount: { userId } },
            { subAccount: { userId } }
          ]
        }
      });

      // 2. Delete MT5 accounts to release VPS/terminal capacity
      await prisma.mt5Account.deleteMany({
        where: { userId }
      });

      // 3. Mark subscription status as EXPIRED
      if (user.subscription && user.subscription.status === 'TRIAL') {
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { status: 'EXPIRED' }
        });
      }

      // 4. Send user notification
      await prisma.userNotification.create({
        data: {
          userId,
          title: 'Connected Accounts Cleared',
          message: 'Your 3-day trial grace period has ended without selecting a plan. All connected MT5 accounts have been cleared. Select a plan on the Pricing page to reconnect.',
          type: 'ALERT',
          actionUrl: '/pricing'
        }
      }).catch(() => {});
    }
  } catch (err: any) {
    console.error('Failed to enforce trial grace cleanup:', err);
  }
}
