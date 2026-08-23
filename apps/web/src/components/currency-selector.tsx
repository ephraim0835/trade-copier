'use client';

import { useCurrency } from './currency-provider';
import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="plaiz-pill plaiz-pill-neutral hover:bg-black/5 dark:hover:bg-white/5 pr-2 pl-3 group"
      >
        <span className="font-semibold">{currency}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 ml-1 text-muted-foreground transition-transform duration-200",
          isOpen ? "rotate-180" : ""
        )} />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-32 plaiz-card rounded-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={() => {
              setCurrency('USD');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <span>USD</span>
            {currency === 'USD' && <Check className="w-4 h-4 text-primary" />}
          </button>
          <button
            onClick={() => {
              setCurrency('NGN');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <span>NGN</span>
            {currency === 'NGN' && <Check className="w-4 h-4 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
