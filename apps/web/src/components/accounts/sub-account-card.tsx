'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Settings2, Activity, Trash2, Power, PowerOff, AlertCircle, RefreshCw, Loader2, CheckCircle2, Wifi } from 'lucide-react';
import { MoneyDisplay } from '@/components/money-display';
import { ProtectedAction } from '@/components/protected-action';
import { toggleAccountActive, deleteAccount, retryAccountConnection, getAccountConnectionStatus } from '@/app/actions/account-actions';
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
    lastHeartbeatAt?: string | Date | null;
    floatingPl?: number | null;
    equity?: number | null;
    copySettings?: { riskPercentage?: number | null } | null;
  };
}

export function SubAccountCard({ account }: SubAccountCardProps) {
  const [accountData, setAccountData] = useState(account);
  const [isActive, setIsActive] = useState(account.isActive);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [justConnected, setJustConnected] = useState(false);
  const router = useRouter();

  // Prevent hydration mismatch by evaluating time-sensitive logic only on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync state if parent props update
  useEffect(() => {
    setAccountData(account);
    setIsActive(account.isActive);
  }, [account]);

  const isFailed = accountData.connectionStatus === 'FAILED' || !!accountData.provisioningError;
  const isConnecting = accountData.connectionStatus === 'PROVISIONING' || accountData.connectionStatus === 'PENDING';

  // Evaluate online status based on fresh UTC heartbeat and ONLINE connection status
  const hbTime = accountData.lastHeartbeatAt || accountData.updatedAt;
  const isOnline = !isFailed && !isConnecting && (accountData.isActive ?? false) && accountData.connectionStatus === 'ONLINE' && hbTime
    ? (Math.abs(Date.now() - new Date(hbTime).getTime()) < 180_000)
    : false;

  // Polling for live status updates:
  // - High frequency (2s) when connecting or provisioning
  // - Low frequency (15s) in background to keep heartbeat and balances fresh
  useEffect(() => {
    const pollIntervalMs = isConnecting ? 2000 : 15000;

    let elapsedTimer: NodeJS.Timeout | null = null;
    if (isConnecting) {
      elapsedTimer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }

    const pollTimer = setInterval(async () => {
      try {
        const res = await getAccountConnectionStatus(accountData.id);
        if (res.success && res.account) {
          const acc = res.account;
          setAccountData(prev => ({
            ...prev,
            connectionStatus: acc.connectionStatus ?? prev.connectionStatus,
            provisioningError: acc.provisioningError,
            balance: acc.balance ?? prev.balance,
            equity: acc.equity ?? prev.equity,
            currency: acc.currency ?? prev.currency,
            lastHeartbeatAt: acc.lastHeartbeatAt ?? prev.lastHeartbeatAt,
          }));

          if (isConnecting && acc.connectionStatus === 'ONLINE') {
            setJustConnected(true);
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error polling sub account connection status:', err);
      }
    }, pollIntervalMs);

    return () => {
      if (elapsedTimer) clearInterval(elapsedTimer);
      clearInterval(pollTimer);
    };
  }, [isConnecting, accountData.id, router]);

  function handleToggle() {
    startTransition(async () => {
      const next = !isActive;
      setIsActive(next);
      const res = await toggleAccountActive(accountData.id, next);
      if (!res.success) setIsActive(!next); // revert on error
    });
  }

  function handleRetry() {
    setElapsedSeconds(0);
    setJustConnected(false);
    // Optimistically transition into animated connecting state
    setAccountData(prev => ({
      ...prev,
      connectionStatus: 'PENDING',
      provisioningError: null,
    }));

    startTransition(async () => {
      await retryAccountConnection(accountData.id);
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
      await deleteAccount(accountData.id);
      router.refresh();
    });
  }

  return (
    <div className={`plaiz-card p-6 flex flex-col justify-between group transition-all duration-300 ${
      isFailed 
        ? 'border-destructive/40 shadow-sm shadow-destructive/5' 
        : isConnecting
        ? 'border-amber-500/30 shadow-sm shadow-amber-500/5'
        : isOnline
        ? 'border-emerald-500/25 shadow-sm shadow-emerald-500/5'
        : 'border-border/40'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full transition-colors ${
              isFailed 
                ? 'bg-destructive' 
                : isConnecting 
                ? 'bg-amber-500 animate-pulse' 
                : isOnline 
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' 
                : 'bg-destructive/80'
            }`} />
            <span className="font-semibold text-lg">{accountData.displayName || accountData.login}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isFailed ? (
              <span className="plaiz-pill plaiz-pill-destructive text-[10px] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Failed
              </span>
            ) : isConnecting ? (
              <span className="plaiz-pill text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
              </span>
            ) : isOnline ? (
              <span className="plaiz-pill plaiz-pill-success text-[10px] flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="plaiz-pill plaiz-pill-destructive text-[10px] flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Offline
              </span>
            )}
            <span className="plaiz-pill plaiz-pill-neutral text-[10px]">
              {accountData.broker}
            </span>
          </div>
        </div>

        {/* Detailed Connection Error Banner */}
        {isFailed && (() => {
          const details = getFriendlyErrorDetails(accountData.provisioningError);
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
                  {accountData.server && (
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      Server: <strong>{accountData.server}</strong> &bull; Login ID: <strong>{accountData.login}</strong>
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

        {/* Connecting Step Timeline (Identical Progressive Feedback to Modal) */}
        {isConnecting && (
          <div className="mb-4 bg-black/5 dark:bg-white/5 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3 text-left animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/15 pb-2">
              <span className="flex items-center gap-1.5 text-amber-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting to {accountData.server || 'broker'}...
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{elapsedSeconds}s</span>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-foreground">Account registered & encrypted</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="font-medium text-foreground">Provisioning MT5 sandbox instance</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  elapsedSeconds > 8 ? "bg-primary/20 text-primary" : "bg-black/10 dark:bg-white/10 text-muted-foreground"
                }`}>
                  {elapsedSeconds > 8 ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  )}
                </div>
                <span className={`font-medium ${elapsedSeconds > 8 ? "text-foreground" : "text-muted-foreground"}`}>
                  Attaching SubCopier EA & establishing heartbeat
                </span>
              </div>
            </div>

            {elapsedSeconds >= 40 && (
              <p className="text-[10px] text-amber-500 font-medium pt-1 border-t border-border/10">
                Taking a moment? Ensure VPS bot daemon is active on your server.
              </p>
            )}
          </div>
        )}

        {/* Success Notice Banner */}
        {(justConnected || (isOnline && !isFailed && !isConnecting)) && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-left animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-emerald-500 block">Terminal Online & Ready</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Successfully authenticated with <strong className="text-foreground">{accountData.broker || 'broker'}</strong>. Ready for trade copying.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={
              isFailed 
                ? 'text-destructive font-medium' 
                : isConnecting 
                ? 'text-amber-500 font-medium flex items-center gap-1.5' 
                : isOnline 
                ? 'text-emerald-500 font-medium flex items-center gap-1.5' 
                : 'text-destructive font-medium flex items-center gap-1.5'
            }>
              {isFailed 
                ? 'Connection Rejected' 
                : isConnecting 
                ? 'Connecting to Broker...' 
                : isOnline 
                ? 'Online' 
                : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-bold num-tabular text-foreground">
              {accountData.balance != null
                ? <MoneyDisplay amount={accountData.balance} sourceCurrency={accountData.currency || 'USD'} accountId={accountData.id} liveType="balance" />
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Equity</span>
            <div className="flex gap-2 items-center">
              <span className="font-bold num-tabular text-foreground">
                <MoneyDisplay 
                  amount={accountData.equity ?? ((accountData.balance || 0) + (accountData.floatingPl || 0))} 
                  sourceCurrency={accountData.currency || 'USD'} 
                  accountId={accountData.id} 
                  liveType="equity" 
                />
              </span>
              {accountData.floatingPl != null ? (
                <span className={`text-[11px] font-semibold ${accountData.floatingPl > 0 ? 'text-emerald-500' : accountData.floatingPl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  (<MoneyDisplay amount={accountData.floatingPl} sourceCurrency={accountData.currency || 'USD'} accountId={accountData.id} liveType="floatingPl" />)
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risk Percentage</span>
            <span className="font-bold num-tabular text-foreground">
              {accountData.copySettings?.riskPercentage?.toFixed(2) || '1.00'}%
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t border-border/40">
        {/* Primary actions */}
        <div className="flex items-center gap-2">
          <ProtectedAction className="flex-1 flex">
            <Link
              href={`/accounts/${accountData.id}/settings`}
              className="plaiz-btn plaiz-btn-primary flex-1 justify-center"
            >
              <Settings2 className="w-4 h-4" />
              Risk Controls
            </Link>
          </ProtectedAction>

          {/* View activity log for this account */}
          <Link
            href={`/activity?account=${accountData.id}`}
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
