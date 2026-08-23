'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type CurrencyCode = 'USD' | 'NGN';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  exchangeRate: number; // NGN per 1 USD
  formatMoney: (amount: number, sourceCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1500); // Default fallback

  useEffect(() => {
    // Load preference from local storage
    const saved = localStorage.getItem('plaiz-currency') as CurrencyCode;
    if (saved && (saved === 'USD' || saved === 'NGN')) {
      setCurrencyState(saved);
    }

    // Fetch live exchange rate securely from public free API
    // This allows conversion without touching the NestJS backend
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates && data.rates.NGN) {
          setExchangeRate(data.rates.NGN);
        }
      })
      .catch(err => {
        console.error('Failed to fetch exchange rate, using fallback.', err);
      });
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('plaiz-currency', code);
  };

  const formatMoney = (amount: number, sourceCurrency: string = 'USD') => {
    // If the source is somehow not USD, we just format it natively for now 
    // since backend currently operates in USD
    if (sourceCurrency !== 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: sourceCurrency,
        minimumFractionDigits: 2
      }).format(amount);
    }

    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount);
    }

    if (currency === 'NGN') {
      // Convert to NGN
      const converted = amount * exchangeRate;
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0
      }).format(converted);
    }

    return amount.toString();
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRate, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
