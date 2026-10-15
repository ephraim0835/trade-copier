'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MoneyDisplayProps {
  amount: number;
  sourceCurrency?: string;
  className?: string;
  accountId?: string;
  liveType?: 'balance' | 'equity' | 'floatingPl';
}

export function MoneyDisplay({ amount, sourceCurrency = 'USD', className = '', accountId, liveType }: MoneyDisplayProps) {
  const { formatMoney } = useCurrency();
  const [mounted, setMounted] = useState(false);
  const [localAmount, setLocalAmount] = useState(amount);

  useEffect(() => {
    setMounted(true);
    
    if (!accountId || !liveType) return;

    const handleRealtime = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      if (payload && payload.accountId === accountId) {
        if (liveType === 'equity') {
          const eq = payload.equity ?? (payload.balance !== undefined ? payload.balance + (payload.floatingPl || 0) : undefined);
          if (eq !== undefined) setLocalAmount(eq);
        } else if (liveType === 'balance') {
          if (payload.balance !== undefined) setLocalAmount(payload.balance);
        } else if (liveType === 'floatingPl') {
          if (payload.floatingPl !== undefined) setLocalAmount(payload.floatingPl);
        }
      }
    };
    
    window.addEventListener('realtime-refresh', handleRealtime);
    return () => window.removeEventListener('realtime-refresh', handleRealtime);
  }, [accountId, liveType]);

  useEffect(() => {
    setLocalAmount(amount);
  }, [amount]);

  // During SSR and initial hydration, we render a fallback or standard USD to prevent hydration mismatch
  if (!mounted) {
    return (
      <span className={className} suppressHydrationWarning>
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: sourceCurrency,
          minimumFractionDigits: 2
        }).format(localAmount)}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatMoney(localAmount, sourceCurrency)}
    </span>
  );
}
