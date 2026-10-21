'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';
import { TrialGraceStatus } from '@/lib/trial-grace';

interface TrialGraceBannerProps {
  status: TrialGraceStatus;
}

export function TrialGraceBanner({ status }: TrialGraceBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  // Active 5-Day Free Trial
  if (status.isTrial && !status.isTrialExpired) {
    const daysLabel = status.trialDaysRemaining === 1 
      ? '1 trading day' 
      : `${status.trialDaysRemaining || 5} trading days`;

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300 relative">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground">
                5-Day Free Trial Active
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                {daysLabel} Left (Weekends Excluded)
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              You are on a <strong>5-Day Free Trial</strong>. Saturdays and Sundays do not count against your trial duration, giving you 5 full trading days of unrestricted automated trade copying.
              {status.trialEndsAt && (
                <span className="ml-1 text-foreground/80 font-medium">
                  Valid until {new Date(status.trialEndsAt).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <Link
            href="/pricing"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shadow-md transition-all text-center"
          >
            <span>View Plans</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss trial banner"
            className="px-2.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (!status.inGracePeriod && !status.isGraceExpired) {
    return null;
  }

  if (status.inGracePeriod) {
    const timeLabel = status.graceDaysRemaining > 1 
      ? `${status.graceDaysRemaining} days` 
      : `${status.graceHoursRemaining} hours`;

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground">
                5-Day Free Trial Expired — 3-Day Grace Period
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                {timeLabel} Left to Pick a Plan
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Trade copying is currently paused. You have <strong>{timeLabel}</strong> remaining to select a plan before your existing connected MT5 accounts and configurations are automatically cleared.
            </p>
          </div>
        </div>

        <Link
          href="/pricing"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-md transition-all self-stretch sm:self-auto text-center justify-center"
        >
          <Sparkles className="w-4 h-4" />
          Select a Plan & Keep Accounts
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // Grace Period Expired State
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-destructive/10 border border-destructive/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-bold text-sm text-foreground">
            Trial & 3-Day Grace Period Expired
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Your 3-day grace period has ended without selecting a plan. Existing connected accounts have been cleared. Select a plan to connect new terminals and resume automated copying.
          </p>
        </div>
      </div>

      <Link
        href="/pricing"
        className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md transition-all self-stretch sm:self-auto text-center justify-center"
      >
        Choose a Plan to Reconnect
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
