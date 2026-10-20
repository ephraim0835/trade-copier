'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Wifi } from 'lucide-react';
import { retryAccountConnection, getAccountConnectionStatus } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';

export interface ReconnectButtonProps {
  accountId: string;
  accountName?: string;
  isOnline?: boolean;
  connectionStatus?: string | null;
  variant?: 'button' | 'compact' | 'icon' | 'pill' | 'banner';
  className?: string;
  onReconnected?: () => void;
}

export function ReconnectButton({
  accountId,
  accountName,
  isOnline = false,
  connectionStatus,
  variant = 'compact',
  className = '',
  onReconnected,
}: ReconnectButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConnecting, setIsConnecting] = useState(
    connectionStatus === 'PROVISIONING' || connectionStatus === 'PENDING'
  );
  const [elapsed, setElapsed] = useState(0);
  const [justConnected, setJustConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (connectionStatus === 'PROVISIONING' || connectionStatus === 'PENDING') {
      setIsConnecting(true);
    }
  }, [connectionStatus]);

  // Polling watchdog while connecting
  useEffect(() => {
    if (!isConnecting) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setElapsed(0);
      return;
    }

    const elapsedInterval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await getAccountConnectionStatus(accountId);
        if (res.success && res.account) {
          const acc = res.account;
          if (acc.connectionStatus === 'ONLINE') {
            setIsConnecting(false);
            setJustConnected(true);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            onReconnected?.();
            router.refresh();
            setTimeout(() => setJustConnected(false), 4000);
          } else if (acc.connectionStatus === 'FAILED') {
            setIsConnecting(false);
            setErrorMessage(acc.provisioningError || 'Broker rejected connection');
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.error('Watchdog error polling connection status:', err);
      }
    }, 2000);

    return () => {
      clearInterval(elapsedInterval);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isConnecting, accountId, router, onReconnected]);

  function handleReconnect(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPending || isConnecting) return;

    setErrorMessage(null);
    setJustConnected(false);
    setIsConnecting(true);
    setElapsed(0);

    startTransition(async () => {
      const res = await retryAccountConnection(accountId);
      if (!res.success) {
        setIsConnecting(false);
        setErrorMessage(res.error || 'Failed to trigger reconnect');
      }
    });
  }

  // Just successfully connected state
  if (justConnected) {
    if (variant === 'icon') {
      return (
        <span className="inline-flex p-1.5 rounded-lg text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" title="Connected successfully">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 animate-in fade-in duration-200 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        Connected!
      </span>
    );
  }

  // Connecting / In-progress state
  if (isConnecting || isPending) {
    if (variant === 'icon') {
      return (
        <button
          disabled
          className="inline-flex p-1.5 rounded-lg text-amber-500 bg-amber-500/10 border border-amber-500/20 animate-pulse cursor-not-allowed"
          title={`Reconnecting (${elapsed}s)...`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        </button>
      );
    }

    if (variant === 'pill') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse ${className}`}>
          <Loader2 className="w-3 h-3 animate-spin" />
          Reconnecting {elapsed > 0 ? `(${elapsed}s)` : '...'}
        </span>
      );
    }

    return (
      <button
        disabled
        className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/25 cursor-not-allowed transition-all ${className}`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Reconnecting {elapsed > 0 ? `(${elapsed}s)` : '...'}</span>
      </button>
    );
  }

  // Variant: Icon only
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleReconnect}
        title={isOnline ? `Reconnect ${accountName || 'account'}` : `Account is Offline. Click to reconnect.`}
        className={`p-1.5 rounded-lg border transition-all duration-200 ${
          isOnline
            ? 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-primary/40'
            : 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50'
        } ${className}`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    );
  }

  // Variant: Pill (compact badge-sized button)
  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleReconnect}
        title={`Reconnect ${accountName || 'account'}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 border shadow-sm ${
          isOnline
            ? 'border-border/40 bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/50'
        } ${className}`}
      >
        <RefreshCw className="w-2.5 h-2.5" />
        Reconnect
      </button>
    );
  }

  // Variant: Full button (primary / high-emphasis)
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleReconnect}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 ${
          isOnline
            ? 'bg-secondary text-foreground hover:bg-secondary/80 border border-border/40'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } ${className}`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{isOnline ? 'Reconnect MT5 Link' : 'Reconnect Account'}</span>
      </button>
    );
  }

  // Variant: Compact (default for card footers / lists)
  return (
    <button
      type="button"
      onClick={handleReconnect}
      title={`Reconnect ${accountName || 'account'}`}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all duration-200 ${
        isOnline
          ? 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/40'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50'
      } ${className}`}
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>Reconnect</span>
    </button>
  );
}
