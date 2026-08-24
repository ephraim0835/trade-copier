'use client';

import { useSubscription } from './subscription-provider';
import { AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function PaywallBanner() {
  const { isActive } = useSubscription();

  if (isActive) return null;

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 text-destructive-foreground px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 z-50 relative">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm font-medium text-foreground">
          Your account is inactive. Please subscribe to a plan to start copying trades.
        </p>
      </div>
      <Link 
        href="/pricing" 
        className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        View Plans
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
