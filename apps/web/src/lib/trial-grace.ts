import { prisma } from './prisma';

export interface TrialGraceStatus {
  isTrial: boolean;
  isPaidOrAdmin: boolean;
  isTrialExpired: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining?: number;
  trialHoursRemaining?: number;
  inGracePeriod: boolean;
  gracePeriodEndsAt: Date | null;
  graceHoursRemaining: number;
  graceDaysRemaining: number;
  isGraceExpired: boolean;
  canConnectAccounts: boolean;
  canCopyTrades: boolean;
  bannerTitle?: string;
  bannerMessage?: string;
  isSubscriptionGrace?: boolean;
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
 * Calculates remaining trading/business days between now and targetDate,
 * strictly skipping Saturdays and Sundays.
 */
export function getBusinessDaysRemaining(targetDate: Date): number {
  const now = new Date();
  if (now >= targetDate) return 0;
  
  let count = 0;
  const current = new Date(now.getTime());
  while (current < targetDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
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
  const now = Date.now();
  const currentPeriodEnd = user.subscription?.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd) : null;
  const isPeriodEnded = currentPeriodEnd ? currentPeriodEnd.getTime() <= now : false;

  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';
  const isInternalFree = user.subscription?.status === 'INTERNAL_FREE';
  const isActivePaid = user.subscription?.status === 'ACTIVE' && !isPeriodEnded;

  if (isAdmin || isInternalFree || isActivePaid) {
    return {
      isTrial: false,
      isPaidOrAdmin: true,
      isTrialExpired: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      trialHoursRemaining: 0,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      graceHoursRemaining: 0,
      graceDaysRemaining: 0,
      isGraceExpired: false,
      canConnectAccounts: true,
      canCopyTrades: true,
    };
  }

  // Handle active subscription past renewal date (with 3-day grace period)
  if (user.subscription?.status === 'ACTIVE' && isPeriodEnded && currentPeriodEnd) {
    const periodEndMs = currentPeriodEnd.getTime();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days = 72 Hours
    const graceEndMs = periodEndMs + THREE_DAYS_MS;
    const gracePeriodEndsAt = new Date(graceEndMs);

    const inGracePeriod = now <= graceEndMs;
    const isGraceExpired = now > graceEndMs;

    const msRemaining = Math.max(0, graceEndMs - now);
    const graceHoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const graceDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const timeLabel = graceDaysRemaining > 1 ? `${graceDaysRemaining} days` : `${graceHoursRemaining} hours`;

    if (inGracePeriod) {
      return {
        isTrial: false,
        isPaidOrAdmin: false,
        isTrialExpired: false,
        trialEndsAt: null,
        trialDaysRemaining: 0,
        trialHoursRemaining: 0,
        inGracePeriod: true,
        gracePeriodEndsAt,
        graceHoursRemaining,
        graceDaysRemaining,
        isGraceExpired: false,
        canConnectAccounts: true,
        canCopyTrades: true, // 3-day grace period preserves trade copying while user renews
        bannerTitle: `Subscription Renewal Due — 3-Day Grace Period Active (${timeLabel} remaining)`,
        bannerMessage: `Your subscription is due for renewal. You have ${timeLabel} remaining in your 3-day grace period to complete payment before automated trade copying is paused.`,
        isSubscriptionGrace: true,
      };
    }

    // 3-Day grace period expired
    return {
      isTrial: false,
      isPaidOrAdmin: false,
      isTrialExpired: true,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      trialHoursRemaining: 0,
      inGracePeriod: false,
      gracePeriodEndsAt,
      graceHoursRemaining,
      graceDaysRemaining,
      isGraceExpired: true,
      canConnectAccounts: false,
      canCopyTrades: false,
      bannerTitle: 'Subscription & 3-Day Grace Period Expired',
      bannerMessage: 'Your subscription renewal and 3-day grace period have expired. Automated trade copying is paused. Please renew your plan to reactivate copying.',
      isSubscriptionGrace: true,
    };
  }

  // Handle explicitly cancelled subscription
  if (user.subscription?.status === 'CANCELED') {
    return {
      isTrial: false,
      isPaidOrAdmin: false,
      isTrialExpired: true,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      trialHoursRemaining: 0,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      graceHoursRemaining: 0,
      graceDaysRemaining: 0,
      isGraceExpired: true,
      canConnectAccounts: false,
      canCopyTrades: false,
      bannerTitle: 'Subscription Cancelled',
      bannerMessage: 'Your subscription has been cancelled. Automated trade copying is paused. Select a plan to reactivate copying.',
    };
  }

  const isTrial = user.subscription?.status === 'TRIAL' || user.subscription?.planId === 'trial';

  if (!isTrial || !currentPeriodEnd) {
    const isExpiredStatus = user.subscription?.status === 'EXPIRED';
    return {
      isTrial: false,
      isPaidOrAdmin: false,
      isTrialExpired: true,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      trialHoursRemaining: 0,
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

  const msUntilTrialEnd = Math.max(0, trialEndMs - now);
  const trialHoursRemaining = Math.floor(msUntilTrialEnd / (1000 * 60 * 60));
  const trialDaysRemaining = getBusinessDaysRemaining(currentPeriodEnd);

  let bannerTitle: string | undefined;
  let bannerMessage: string | undefined;

  if (!isTrialExpired) {
    const daysLabel = trialDaysRemaining === 1 ? '1 trading day' : `${trialDaysRemaining} trading days`;
    bannerTitle = `5-Day Free Trial Active (${daysLabel} remaining)`;
    bannerMessage = `You are on a 5-day free trial (${daysLabel} left, weekends excluded). Enjoy full platform access to automated trade copying.`;
  } else if (inGracePeriod) {
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
    trialDaysRemaining,
    trialHoursRemaining,
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

    // Handle Active Subscription Grace & Alerts (if subscription isn't renewed)
    if (user.subscription && user.subscription.status === 'ACTIVE' && user.subscription.currentPeriodEnd) {
      const periodEnd = new Date(user.subscription.currentPeriodEnd);
      const isPeriodEnded = periodEnd.getTime() <= Date.now();

      if (isPeriodEnded) {
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const graceEndMs = periodEnd.getTime() + THREE_DAYS_MS;
        const gracePeriodEndsAt = new Date(graceEndMs);
        const inGrace = Date.now() <= graceEndMs;

        if (inGrace) {
          // Check if grace period alert was already sent for this billing period
          const existingAlert = await prisma.userNotification.findFirst({
            where: {
              userId,
              title: { contains: 'Subscription Renewal Due' },
              createdAt: { gte: periodEnd }
            }
          });

          if (!existingAlert) {
            const formattedGraceDate = gracePeriodEndsAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            // In-App Alert Notification (strictly in-app to prevent phishing/spoofing attacks)
            await prisma.userNotification.create({
              data: {
                userId,
                title: 'Subscription Renewal Due — 3-Day Grace Period Active',
                message: `Your ${user.subscription.planId?.toUpperCase() || ''} subscription is due for renewal. A 3-day grace period is active until ${formattedGraceDate}. Automated trade copying will remain active during this period. Please complete renewal to avoid copying interruption.`,
                type: 'ALERT',
                actionUrl: '/pricing',
              }
            }).catch((e) => console.error('Could not create grace notification:', e));
          }
        } else {
          // Grace period is expired (> 3 days past currentPeriodEnd)
          const existingExpiredAlert = await prisma.userNotification.findFirst({
            where: {
              userId,
              title: { contains: 'Subscription Grace Period Expired' },
              createdAt: { gte: gracePeriodEndsAt }
            }
          });

          if (!existingExpiredAlert) {
            await prisma.userNotification.create({
              data: {
                userId,
                title: 'Subscription Grace Period Expired — Copying Paused',
                message: 'Your 3-day subscription grace period has ended without renewal. Automated trade copying is now paused. Please renew your subscription to resume copying.',
                type: 'ALERT',
                actionUrl: '/pricing',
              }
            }).catch((e) => console.error('Could not create expired notification:', e));
          }
        }
      }
    }

    // Trial grace expiration: clear MT5 accounts only for trial users who never selected a plan
    if (status.isTrial && status.isGraceExpired && user.accounts.length > 0) {
      console.log(`[GracePeriod] Clearing ${user.accounts.length} accounts for trial user ${userId} whose 3-day grace period expired.`);

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
