'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_RATES_TO_USD } from '@/lib/currency';

type CurrencyCode = 'USD' | 'NGN';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  exchangeRate: number; // NGN per 1 USD
  rates: Record<string, number>;
  isLoadingRates: boolean;
  convertAmount: (amount: number, fromCurrency?: string, toCurrency?: string) => number;
  formatMoney: (amount: number, sourceCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRate = localStorage.getItem('plaiz-fx-ngn');
        if (savedRate && !isNaN(Number(savedRate)) && Number(savedRate) > 100) {
          return Number(savedRate);
        }
      } catch {}
    }
    return 1350;
  });
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES_TO_USD);
  const [isLoadingRates, setIsLoadingRates] = useState<boolean>(true);

  const applyRates = (newRates: Record<string, number>) => {
    setRates(newRates);
    if (newRates.NGN && newRates.NGN > 0) {
      setExchangeRate(newRates.NGN);
      try {
        localStorage.setItem('plaiz-fx-ngn', String(newRates.NGN));
      } catch {}
    }
  };

  const fetchRates = async () => {
    try {
      // 1. Try local Next.js cached API endpoint
      const res = await fetch('/api/currency/rates');
      if (res.ok) {
        const data = await res.json();
        if (data?.rates) {
          applyRates(data.rates);
          setIsLoadingRates(false);
          return;
        }
      }

      // 2. Fallback to primary public open forex feed
      const directRes = await fetch('https://open.er-api.com/v6/latest/USD');
      if (directRes.ok) {
        const directData = await directRes.json();
        if (directData?.rates) {
          applyRates(directData.rates);
          setIsLoadingRates(false);
          return;
        }
      }

      // 3. Fallback to secondary public forex feed
      const secondaryRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (secondaryRes.ok) {
        const secondaryData = await secondaryRes.json();
        if (secondaryData?.rates) {
          applyRates(secondaryData.rates);
          setIsLoadingRates(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live exchange rate, using cached/fallback:', err);
    } finally {
      setIsLoadingRates(false);
    }
  };

  useEffect(() => {
    // Load preference from local storage
    const saved = localStorage.getItem('plaiz-currency') as CurrencyCode;
    if (saved && (saved === 'USD' || saved === 'NGN')) {
      setCurrencyState(saved);
    }

    fetchRates();

    // Refresh exchange rates every 5 minutes
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('plaiz-currency', code);
  };

  const convertAmount = (amount: number, fromCurrency: string = 'USD', toCurrency: string = currency): number => {
    if (!amount || isNaN(amount)) return 0;
    const fromCode = fromCurrency.toUpperCase().trim();
    const toCode = toCurrency.toUpperCase().trim();
    if (fromCode === toCode) return amount;

    // Convert from source to USD
    let inUSD = amount;
    if (fromCode !== 'USD') {
      const fromRate = rates[fromCode] || DEFAULT_RATES_TO_USD[fromCode] || 1.0;
      inUSD = fromRate > 0 ? amount / fromRate : amount;
    }

    // Convert from USD to target
    if (toCode === 'USD') return inUSD;
    const toRate = rates[toCode] || (toCode === 'NGN' ? exchangeRate : DEFAULT_RATES_TO_USD[toCode]) || 1.0;
    return inUSD * toRate;
  };

  const formatMoney = (amount: number, sourceCurrency: string = 'USD') => {
    const fromCode = (sourceCurrency || 'USD').toUpperCase().trim();
    const targetCurrency = currency;

    const converted = convertAmount(amount, fromCode, targetCurrency);

    if (targetCurrency === 'NGN') {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(converted);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      setCurrency, 
      exchangeRate, 
      rates, 
      isLoadingRates, 
      convertAmount, 
      formatMoney 
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    return {
      currency: 'USD' as CurrencyCode,
      setCurrency: () => {},
      exchangeRate: 1350,
      rates: DEFAULT_RATES_TO_USD,
      isLoadingRates: false,
      convertAmount: (amount: number) => amount,
      formatMoney: (amount: number) => `$${amount.toFixed(2)}`,
    };
  }
  return context;
}
