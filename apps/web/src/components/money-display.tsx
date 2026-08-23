'use client';

import { useCurrency } from './currency-provider';
import { useEffect, useState } from 'react';

interface MoneyDisplayProps {
  amount: number;
  sourceCurrency?: string;
  className?: string;
}

export function MoneyDisplay({ amount, sourceCurrency = 'USD', className = '' }: MoneyDisplayProps) {
  const { formatMoney } = useCurrency();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, we render a fallback or standard USD to prevent hydration mismatch
  if (!mounted) {
    return (
      <span className={className}>
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: sourceCurrency,
          minimumFractionDigits: 2
        }).format(amount)}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatMoney(amount, sourceCurrency)}
    </span>
  );
}
