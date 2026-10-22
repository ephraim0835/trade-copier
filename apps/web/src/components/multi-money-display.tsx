'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MultiMoneyDisplayProps {
  balances: { id?: string; amount: number; currency: string }[];
  className?: string;
  colored?: boolean;
  showSign?: boolean;
  liveType?: 'balance' | 'equity' | 'floatingPl';
}

export function MultiMoneyDisplay({ balances, className = '', colored = false, showSign = false, liveType }: MultiMoneyDisplayProps) {
  const { currency, exchangeRate, formatMoney, convertAmount } = useCurrency();
  const [mounted, setMounted] = useState(false);
  const [localBalances, setLocalBalances] = useState(balances);

  useEffect(() => {
    setMounted(true);
    
    // Listen for realtime SSE events emitted by AutoRefresh
    const handleRealtime = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      if (!payload || !payload.accountId || !liveType) return;
      
      setLocalBalances(prev => {
        // Only update if this balance array actually contains the accountId
        const exists = prev.some(b => b.id === payload.accountId);
        if (!exists) return prev;
        
        return prev.map(b => {
          if (b.id === payload.accountId) {
            let nextAmount = b.amount;
            if (liveType === 'equity') {
              nextAmount = payload.equity ?? (payload.balance !== undefined ? payload.balance + (payload.floatingPl || 0) : b.amount);
            } else if (liveType === 'balance') {
              if (payload.balance !== undefined) nextAmount = payload.balance;
            } else if (liveType === 'floatingPl') {
              if (payload.floatingPl !== undefined) nextAmount = payload.floatingPl;
            }
            return {
              ...b,
              amount: nextAmount
            };
          }
          return b;
        });
      });
    };
    
    window.addEventListener('realtime-refresh', handleRealtime);
    return () => window.removeEventListener('realtime-refresh', handleRealtime);
  }, [liveType]);

  // Sync with SSR props if they change (e.g. from a real router.refresh())
  useEffect(() => {
    setLocalBalances(balances);
  }, [balances]);

  // Calculate the total in the target currency using live rates
  const total = localBalances.reduce((sum, balance) => {
    const source = (balance.currency || 'USD').toUpperCase();
    const converted = convertAmount(balance.amount, source, currency);
    return sum + converted;
  }, 0);

  if (!mounted) {
    // SSR Fallback (just display something so it doesn't break hydration layout)
    const fallbackSum = localBalances.reduce((sum, b) => sum + b.amount, 0);
    const roundedFallback = Math.round(fallbackSum * 100) / 100;
    const colorClass = colored ? (roundedFallback > 0 ? 'text-emerald-500' : roundedFallback < 0 ? 'text-red-500' : 'text-muted-foreground') : '';
    const sign = showSign && roundedFallback > 0 ? '+' : '';
    return (
      <span className={`${colorClass} ${className}`.trim()} suppressHydrationWarning>
        {sign}{new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2
        }).format(fallbackSum)}
      </span>
    );
  }

  // Format the natively summed total
  const formatted = new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'NGN' ? 0 : 2
  }).format(total);

  const roundedTotal = Math.round(total * 100) / 100;
  const colorClass = colored ? (roundedTotal > 0 ? 'text-emerald-500' : roundedTotal < 0 ? 'text-red-500' : 'text-muted-foreground') : '';
  const sign = showSign && roundedTotal > 0 ? '+' : '';

  return (
    <span className={`${colorClass} ${className}`.trim()}>
      {sign}{formatted}
    </span>
  );
}
