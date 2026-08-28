'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MultiMoneyDisplayProps {
  balances: { amount: number; currency: string }[];
  className?: string;
  colored?: boolean;
  showSign?: boolean;
}

export function MultiMoneyDisplay({ balances, className = '', colored = false, showSign = false }: MultiMoneyDisplayProps) {
  const { currency, exchangeRate, formatMoney } = useCurrency();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate the total in the target currency
  const total = balances.reduce((sum, balance) => {
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
    const fallbackSum = balances.reduce((sum, b) => sum + b.amount, 0);
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
