'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertTriangle, Percent, Wifi } from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';
import { ReconnectButton } from '@/components/accounts/reconnect-button';

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
          const isFailed = account.connectionStatus === 'FAILED' || !!account.provisioningError;
          const isConnecting = account.connectionStatus === 'PROVISIONING' || account.connectionStatus === 'PENDING';
          const isOnline = Boolean(!isFailed && !isConnecting && (account.isActive ?? false) && account.connectionStatus === 'ONLINE' && account.lastHeartbeatAt && (Math.abs(Date.now() - new Date(account.lastHeartbeatAt).getTime()) < 180_000));
          
          return (
            <div key={account.id} className="plaiz-card bg-secondary/30 p-6 rounded-[24px]">
              <div className="flex items-start justify-between mb-6 border-b border-border/30 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[18px] font-bold text-foreground tracking-tight leading-none">{account.displayName || account.login}</h3>
                    <div className={`plaiz-pill text-[9px] px-1.5 py-0.5 ${
                      isFailed ? 'plaiz-pill-destructive' : isConnecting ? 'plaiz-pill-warning' : isOnline ? 'plaiz-pill-success' : 'plaiz-pill-neutral'
                    }`}>
                      <Wifi className={`w-2.5 h-2.5 ${isConnecting ? 'animate-pulse' : ''}`} />
                      {isFailed ? 'Failed' : isConnecting ? 'Connecting...' : isOnline ? 'Online' : 'Offline'}
                    </div>
                    {!isOnline && (
                      <ReconnectButton
                        accountId={account.id}
                        accountName={account.displayName || account.login}
                        variant="pill"
                        isOnline={isOnline}
                        connectionStatus={account.connectionStatus}
                      />
                    )}
                  </div>
                  <span className="plaiz-pill plaiz-pill-neutral text-[10px] uppercase tracking-widest">{account.broker || 'Unknown'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 block">Balance</span>
                  <span className="text-[16px] font-semibold text-foreground num-tabular leading-none">
                    {isOnline && account.balance != null ? (
                      <MoneyDisplay amount={account.balance} sourceCurrency={account.currency || 'USD'} />
                    ) : account.balance != null && !isFailed && account.balance > 0 ? (
                      <MoneyDisplay amount={account.balance} sourceCurrency={account.currency || 'USD'} />
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              {isFailed && (
                <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                  <div className="flex-1">
                    <span className="font-semibold block mb-0.5">Connection Failed</span>
                    <span className="text-destructive/90 leading-tight">{account.provisioningError || "The broker rejected authorization or account details. Please verify your login, password, and server."}</span>
                  </div>
                </div>
              )}

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
