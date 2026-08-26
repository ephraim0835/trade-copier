'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Settings2, Activity, Trash2, Power, PowerOff } from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';
import { ProtectedAction } from '@/components/protected-action';
import { toggleAccountActive, deleteAccount } from '@/app/actions/account-actions';

interface SubAccountCardProps {
  account: {
    id: string;
    login: string;
    displayName?: string | null;
    broker: string | null;
    balance: number | null;
    currency: string | null;
    isActive: boolean;
    copySettings?: { riskMultiplier?: number | null } | null;
    eaTokens?: { lastUsedAt?: Date | null }[];
  };
}

export function SubAccountCard({ account }: SubAccountCardProps) {
  const [isActive, setIsActive] = useState(account.isActive);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isOnline = account.eaTokens?.[0]?.lastUsedAt
    ? new Date().getTime() - new Date(account.eaTokens[0].lastUsedAt).getTime() < 5 * 60 * 1000
    : false;

  function handleToggle() {
    startTransition(async () => {
      const next = !isActive;
      setIsActive(next);
      const res = await toggleAccountActive(account.id, next);
      if (!res.success) setIsActive(!next); // revert on error
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset confirmation state after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    startTransition(async () => {
      await deleteAccount(account.id);
    });
  }

  return (
    <div className="plaiz-card p-6 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
            <span className="font-semibold text-lg">{account.displayName || account.login}</span>
          </div>
          <span className="plaiz-pill plaiz-pill-neutral text-[10px]">
            {account.broker}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={isActive ? 'text-primary font-medium' : 'text-muted-foreground'}>
              {isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-bold num-tabular text-foreground">
              {account.balance != null
                ? <MoneyDisplay amount={account.balance} sourceCurrency={account.currency || 'USD'} />
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risk Multiplier</span>
            <span className="font-bold num-tabular text-foreground">
              {account.copySettings?.riskMultiplier?.toFixed(2) || '1.00'}x
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t border-border/40">
        {/* Primary actions */}
        <div className="flex items-center gap-2">
          <ProtectedAction className="flex-1 flex">
            <Link
              href={`/accounts/${account.id}/settings`}
              className="plaiz-btn plaiz-btn-primary flex-1 justify-center"
            >
              <Settings2 className="w-4 h-4" />
              Risk Controls
            </Link>
          </ProtectedAction>

          {/* View activity log for this account */}
          <Link
            href={`/activity?account=${account.id}`}
            title="View activity log"
            className="plaiz-btn plaiz-btn-secondary px-3"
          >
            <Activity className="w-4 h-4" />
          </Link>
        </div>

        {/* Secondary actions: Toggle + Delete */}
        <div className="flex items-center gap-2">
          <ProtectedAction className="flex-1 flex">
            <button
              onClick={handleToggle}
              disabled={isPending}
              title={isActive ? 'Disable copying' : 'Enable copying'}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all duration-200 ${isActive
                ? 'border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5'
                : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                } disabled:opacity-50`}
            >
              {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
              {isActive ? 'Disable' : 'Enable'}
            </button>
          </ProtectedAction>

          <ProtectedAction>
            <button
              onClick={handleDelete}
              disabled={isPending}
              title={confirmDelete ? 'Click again to confirm deletion' : 'Remove account'}
              className={`px-3 py-2 rounded-xl text-[12px] font-medium border transition-all duration-200 ${confirmDelete
                ? 'border-destructive text-destructive bg-destructive/10 animate-pulse'
                : 'border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5'
                } disabled:opacity-50`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </ProtectedAction>
        </div>

        {confirmDelete && (
          <p className="text-[11px] text-destructive text-center animate-in fade-in">
            Click delete again to confirm — this cannot be undone
          </p>
        )}
      </div>
    </div>
  );
}
