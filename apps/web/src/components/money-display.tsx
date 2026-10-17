'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MoneyDisplayProps {
  amount: number;
  sourceCurrency?: string;
  className?: string;
  accountId?: string;
  liveType?: 'balance' | 'equity' | 'floatingPl';
  colored?: boolean;
  showSign?: boolean;
}

export function MoneyDisplay({
  amount,
  sourceCurrency = 'USD',
  className = '',
  accountId,
  liveType,
  colored = false,
  showSign = false,
}: MoneyDisplayProps) {
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

  const roundedAmount = Math.round((localAmount || 0) * 100) / 100;
  const isPositive = roundedAmount > 0;
  const isNegative = roundedAmount < 0;

  const colorClass = colored
    ? isPositive
      ? 'text-emerald-500'
      : isNegative
      ? 'text-red-500'
      : 'text-muted-foreground'
    : '';

  const sign = showSign && isPositive ? '+' : '';

  // During SSR and initial hydration, we render a fallback or standard USD to prevent hydration mismatch
  if (!mounted) {
    const roundedFallback = Math.round((amount || 0) * 100) / 100;
    const fallbackPositive = roundedFallback > 0;
    const fallbackNegative = roundedFallback < 0;
    const fallbackColor = colored
      ? fallbackPositive
        ? 'text-emerald-500'
        : fallbackNegative
        ? 'text-red-500'
        : 'text-muted-foreground'
      : '';
    const fallbackSign = showSign && fallbackPositive ? '+' : '';

    return (
      <span className={`${fallbackColor} ${className}`.trim()} suppressHydrationWarning>
        {fallbackSign}
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: sourceCurrency,
          minimumFractionDigits: 2
        }).format(localAmount || 0)}
      </span>
    );
  }

  return (
    <span className={`${colorClass} ${className}`.trim()}>
      {sign}{formatMoney(localAmount || 0, sourceCurrency)}
    </span>
  );
}
