'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MultiMoneyDisplayProps {
  balances: { id?: string; amount: number; currency: string }[];
  className?: string;
  colored?: boolean;
  showSign?: boolean;
  liveType?: 'balance' | 'floatingPl';
}

export function MultiMoneyDisplay({ balances, className = '', colored = false, showSign = false, liveType }: MultiMoneyDisplayProps) {
  const { currency, exchangeRate, formatMoney } = useCurrency();
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
            return {
              ...b,
              amount: liveType === 'balance' ? payload.balance : payload.floatingPl
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

  // Calculate the total in the target currency
  const total = localBalances.reduce((sum, balance) => {
    let converted = balance.amount;
    
    // Normalize source currency to match supported standard
    const source = (balance.currency || 'USD').toUpperCase();
    
    if (source === 'NGN' && currency === 'USD') {
      converted = balance.amount / exchangeRate;
    } else if (source === 'USD' && currency === 'NGN') {
      converted = balance.amount * exchangeRate;
    }
    
    return sum + converted;
  }, 0);

  if (!mounted) {
    // SSR Fallback (just display something so it doesn't break hydration layout)
    const fallbackSum = localBalances.reduce((sum, b) => sum + b.amount, 0);
    const colorClass = colored ? (fallbackSum >= 0 ? 'text-emerald-500' : 'text-destructive') : '';
    const sign = showSign && fallbackSum >= 0 ? '+' : '';
    return (
      <span className={`${className} ${colorClass}`} suppressHydrationWarning>
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

  const colorClass = colored ? (total >= 0 ? 'text-emerald-500' : 'text-destructive') : '';
  const sign = showSign && total >= 0 ? '+' : '';

  return (
    <span className={`${className} ${colorClass}`}>
      {sign}{formatted}
    </span>
  );
}
