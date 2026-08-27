'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertTriangle, Percent } from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';

export function RiskControls({ initialAccounts }: { initialAccounts: any[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleAllocationChange = (accountId: string, newPercentage: number) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id === accountId) {
        // Mock updating the copySettings relation in state
        return {
          ...acc,
          copySettings: {
            ...acc.copySettings,
            riskMode: 'PROPORTIONAL',
            riskPercentage: newPercentage
          }
        };
      }
      return acc;
    }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Find accounts that were modified by comparing with initialAccounts
      const modifiedAccounts = accounts.filter(acc => {
        const initial = initialAccounts.find(i => i.id === acc.id);
        const currentPct = acc.copySettings?.riskPercentage;
        const initialPct = initial?.copySettings?.riskPercentage;
        return currentPct !== initialPct;
      });

      // Save each modified account
      await Promise.all(modifiedAccounts.map(async (acc) => {
        const newPct = acc.copySettings?.riskPercentage || 1.0;
        await fetch(`/api/accounts/${acc.id}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riskPercentage: newPct })
        });
      }));
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setIsSaving(false);
      setHasChanges(false);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-foreground">Per-Account Allocations</h2>
        {hasChanges && (
          <button 
            onClick={saveSettings}
            disabled={isSaving}
            className="plaiz-btn plaiz-btn-primary py-2 px-4 text-[12px]"
          >
            {isSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {accounts.map((account) => {
          const currentPct = account.copySettings?.riskPercentage ?? 1.0;
          
          return (
            <div key={account.id} className="plaiz-card bg-secondary/30 p-6 rounded-[24px]">
              <div className="flex items-start justify-between mb-8 border-b border-border/30 pb-6">
                <div>
                  <h3 className="text-[18px] font-bold text-foreground tracking-tight leading-none mb-2">{account.login}</h3>
                  <span className="plaiz-pill plaiz-pill-neutral text-[10px] uppercase tracking-widest">{account.broker || 'Unknown'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Balance</span>
                  <span className="text-[16px] font-semibold text-foreground num-tabular leading-none">
                    {account.balance != null ? <MoneyDisplay amount={account.balance} sourceCurrency={account.currency || 'USD'} /> : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-medium text-[13px]">
                    <Percent className="w-4 h-4 text-primary" />
                    Risk Per Trade
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={currentPct}
                      onChange={(e) => handleAllocationChange(account.id, Number(e.target.value))}
                      className="w-16 bg-black/5 dark:bg-white/5 border border-border/50 rounded-lg px-2 py-1 text-[13px] text-right font-mono text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[13px] text-muted-foreground">%</span>
                  </div>
                </div>

                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.5"
                  value={currentPct}
                  onChange={(e) => handleAllocationChange(account.id, Number(e.target.value))}
                  className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                />

                <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 mt-2">
                  <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    At <span className="font-semibold text-foreground">{currentPct}%</span> risk, the EA will dynamically calculate the exact lot size based on this account's currency, balance, and the Master trade's Stop Loss distance.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
