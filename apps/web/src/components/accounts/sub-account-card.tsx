'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Settings2, Activity, Trash2, Power, PowerOff, AlertCircle, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';
import { ProtectedAction } from '@/components/protected-action';
import { toggleAccountActive, deleteAccount, retryAccountConnection } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';
import { getFriendlyErrorDetails } from '@/lib/error-formatter';

interface SubAccountCardProps {
  account: {
    id: string;
    login: string;
    server?: string | null;
    displayName?: string | null;
    broker: string | null;
    balance: number | null;
    currency: string | null;
    isActive: boolean;
    connectionStatus?: string | null;
    provisioningError?: string | null;
    updatedAt: string | Date;
    floatingPl?: number | null;
    equity?: number | null;
    copySettings?: { riskPercentage?: number | null } | null;
  };
}

export function SubAccountCard({ account }: SubAccountCardProps) {
  const [isActive, setIsActive] = useState(account.isActive);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  
  // Prevent hydration mismatch by evaluating time-sensitive logic only on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isFailed = account.connectionStatus === 'FAILED' || !!account.provisioningError;
  const isProvisioning = account.connectionStatus === 'PROVISIONING';

  const isOnline = isMounted && account.updatedAt && !isFailed
    ? new Date().getTime() - new Date(account.updatedAt).getTime() < 5 * 60 * 1000
    : false;

  function handleToggle() {
    startTransition(async () => {
      const next = !isActive;
      setIsActive(next);
      const res = await toggleAccountActive(account.id, next);
      if (!res.success) setIsActive(!next); // revert on error
    });
  }

  function handleRetry() {
    startTransition(async () => {
      await retryAccountConnection(account.id);
      router.refresh();
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
      router.refresh();
    });
  }

  return (
    <div className={`plaiz-card p-6 flex flex-col justify-between group ${isFailed ? 'border-destructive/40 shadow-sm shadow-destructive/5' : ''}`}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full transition-colors ${
              isFailed ? 'bg-destructive' : isProvisioning ? 'bg-amber-500 animate-pulse' : isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
            }`} />
            <span className="font-semibold text-lg">{account.displayName || account.login}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isFailed ? (
              <span className="plaiz-pill plaiz-pill-destructive text-[10px] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Failed
              </span>
            ) : isProvisioning ? (
              <span className="plaiz-pill text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Provisioning
              </span>
            ) : null}
            <span className="plaiz-pill plaiz-pill-neutral text-[10px]">
              {account.broker}
            </span>
          </div>
        </div>

        {/* Detailed Connection Error Banner */}
        {isFailed && (() => {
          const details = getFriendlyErrorDetails(account.provisioningError);
          return (
            <div className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 flex flex-col gap-2.5 text-xs text-left animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-destructive block">{details.title}</span>
                  <p className="text-[11px] text-destructive/90 leading-relaxed font-medium mt-0.5 break-words">
                    {details.message}
                  </p>
                  {details.suggestion && (
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      <strong className="text-foreground/70 font-semibold">Tip:</strong> {details.suggestion}
                    </p>
                  )}
                  {account.server && (
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      Server: <strong>{account.server}</strong> &bull; Login ID: <strong>{account.login}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-destructive/15">
                <button
                  onClick={handleRetry}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[11px] font-semibold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
                  Retry Connection
                </button>
              </div>
            </div>
          );
        })()}

        {/* Provisioning Notice */}
        {isProvisioning && (
          <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5 text-xs text-primary text-left animate-in fade-in duration-200">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Provisioning MT5 terminal & establishing broker link...</span>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={isFailed ? 'text-destructive font-medium' : isActive ? 'text-primary font-medium' : 'text-muted-foreground'}>
              {isFailed ? 'Connection Rejected' : isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-bold num-tabular text-foreground">
              {account.balance != null
                ? <MoneyDisplay amount={account.balance} sourceCurrency={account.currency || 'USD'} accountId={account.id} liveType="balance" />
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Equity</span>
            <div className="flex gap-2 items-center">
              <span className="font-bold num-tabular text-foreground">
                <MoneyDisplay 
                  amount={account.equity ?? ((account.balance || 0) + (account.floatingPl || 0))} 
                  sourceCurrency={account.currency || 'USD'} 
                  accountId={account.id} 
                  liveType="equity" 
                />
              </span>
              {account.floatingPl != null ? (
                <span className={`text-[11px] font-semibold ${account.floatingPl > 0 ? 'text-emerald-500' : account.floatingPl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  (<MoneyDisplay amount={account.floatingPl} sourceCurrency={account.currency || 'USD'} accountId={account.id} liveType="floatingPl" />)
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risk Percentage</span>
            <span className="font-bold num-tabular text-foreground">
              {account.copySettings?.riskPercentage?.toFixed(2) || '1.00'}%
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
