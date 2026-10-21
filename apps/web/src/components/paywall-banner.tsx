'use client';

import { useSubscription } from './subscription-provider';
import { AlertCircle, ArrowRight, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function PaywallBanner() {
  const { isActive, trialGrace } = useSubscription();
  const pathname = usePathname();

  // If on active 5-day trial, show helpful banner on inner pages
  if (trialGrace?.isTrial && !trialGrace?.isTrialExpired) {
    // On /dashboard, TrialGraceBanner already shows the detailed card
    if (pathname === '/dashboard') return null;

    const daysLabel = trialGrace.trialDaysRemaining === 1 
      ? '1 trading day' 
      : `${trialGrace.trialDaysRemaining || 5} trading days`;

    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-50 relative">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>
            <strong>5-Day Free Trial:</strong> {daysLabel} left (weekends excluded). Full automated copying enabled.
          </span>
        </div>
        <Link 
          href="/pricing" 
          className="shrink-0 text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 transition-colors flex items-center gap-1.5"
        >
          <span>Upgrade to Pro</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  if (isActive) return null;

  const inGrace = trialGrace?.inGracePeriod;
  const isGraceExpired = trialGrace?.isGraceExpired;

  return (
    <div className={cn(
      "border-b px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 z-50 relative",
      inGrace 
        ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
        : "bg-destructive/10 border-destructive/20 text-destructive-foreground"
    )}>
      <div className="flex items-center gap-3">
        {inGrace ? (
          <Clock className="h-5 w-5 text-amber-500 shrink-0 animate-pulse" />
        ) : (
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        )}
        <p className="text-xs sm:text-sm font-medium text-foreground">
          {trialGrace?.bannerMessage || 'Your account is inactive. Please subscribe to a plan to start copying trades.'}
        </p>
      </div>
      <Link 
        href="/pricing" 
        className={cn(
          "shrink-0 text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-sm",
          inGrace
            ? "bg-amber-500 hover:bg-amber-400 text-black"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
      >
        <span>{inGrace ? 'Select Plan & Save Accounts' : 'View Plans'}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
