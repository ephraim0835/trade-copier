'use client';

import { useCurrency } from '@/components/currency-provider';
import { useTheme } from 'next-themes';
import { Globe, Moon, Sun, Monitor, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SettingsControls() {
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-10">
      
      {/* CURRENCY PREFERENCE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Display Currency</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Choose your preferred display currency for all monetary values. Rates are fetched live and applied on the frontend automatically.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0">
          <button
            onClick={() => setCurrency('USD')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${currency === 'USD' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {currency === 'USD' && <Check className="w-3.5 h-3.5" />} USD
          </button>
          <button
            onClick={() => setCurrency('NGN')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${currency === 'NGN' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {currency === 'NGN' && <Check className="w-3.5 h-3.5" />} NGN
          </button>
        </div>
      </div>

      {/* THEME PREFERENCE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Moon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Interface Theme</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Switch between Light Mode and the deep Plaiz Void Dark Mode.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'light' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Sun className="w-4 h-4" /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'dark' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Moon className="w-4 h-4" /> Dark
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'system' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Monitor className="w-4 h-4" /> System
          </button>
        </div>
      </div>

    </div>
  );
}
