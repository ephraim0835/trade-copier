'use client';

import { useCurrency } from './currency-provider';
import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function CurrencySelector() {
  const { currency, setCurrency, exchangeRate } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectiveRate = exchangeRate > 0 ? exchangeRate : 1350;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="plaiz-pill plaiz-pill-neutral hover:bg-black/5 dark:hover:bg-white/5 pr-2 pl-3 group flex items-center gap-1.5"
        title={`Live exchange rate: 1 USD = ₦${Math.round(effectiveRate).toLocaleString()}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold">{currency}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 ml-0.5 text-muted-foreground transition-transform duration-200",
          isOpen ? "rotate-180" : ""
        )} />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-44 plaiz-card rounded-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-left sm:origin-top-right shadow-xl border border-border/60">
          <button
            onClick={() => {
              setCurrency('USD');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <div className="flex flex-col">
              <span className="font-bold text-foreground">USD ($)</span>
              <span className="text-[10px] text-muted-foreground">Base Currency</span>
            </div>
            {currency === 'USD' && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>

          <button
            onClick={() => {
              setCurrency('NGN');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-secondary/50 transition-colors border-t border-border/30"
          >
            <div className="flex flex-col">
              <span className="font-bold text-foreground">NGN (₦)</span>
              <span className="text-[10px] text-muted-foreground">≈ ₦{Math.round(effectiveRate).toLocaleString()} / USD</span>
            </div>
            {currency === 'NGN' && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
