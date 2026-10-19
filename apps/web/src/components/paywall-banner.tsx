'use client';

import { useSubscription } from './subscription-provider';
import { AlertCircle, ArrowRight, Clock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PaywallBanner() {
  const { isActive, trialGrace } = useSubscription();

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
