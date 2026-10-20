'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { retryAccountConnection } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';
import { formatUserFriendlyError, getFriendlyErrorDetails } from '@/lib/error-formatter';

interface MasterStatusAlertProps {
  accountId: string;
  login: string;
  server?: string | null;
  connectionStatus?: string | null;
  provisioningError?: string | null;
  isOnline?: boolean;
}

export function MasterStatusAlert({
  accountId,
  login,
  server,
  connectionStatus,
  provisioningError,
  isOnline = true,
}: MasterStatusAlertProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const isFailed = connectionStatus === 'FAILED' || !!provisioningError;
  const isProvisioning = connectionStatus === 'PROVISIONING' || connectionStatus === 'PENDING';

  if (!isFailed && !isProvisioning && isOnline) return null;

  function handleRetry() {
    startTransition(async () => {
      setFeedback(null);
      const res = await retryAccountConnection(accountId);
      if (res.success) {
        setFeedback('Reconnection queued. Spinning up MT5 terminal...');
        router.refresh();
      } else {
        setFeedback(formatUserFriendlyError(res.error || 'Failed to retry connection'));
      }
    });
  }

  if (isProvisioning) {
    return (
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4 text-xs text-amber-500 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin shrink-0 text-amber-500" />
          <div>
            <span className="font-bold text-foreground block text-sm">Provisioning Master MT5 Terminal...</span>
            <p className="text-muted-foreground text-xs mt-0.5">
              Spinning up dedicated portable instance and authenticating with broker server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isOnline && !isFailed) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs animate-in fade-in">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Master Terminal Offline</h3>
            <p className="text-xs text-rose-500 font-medium mt-1 leading-relaxed">
              The terminal is currently disconnected from the broker. Trades opened on this Master will not copy to your sub accounts until reconnected.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
              <span>Server: <strong className="text-foreground font-mono">{server || 'Unknown'}</strong></span>
              <span>&bull;</span>
              <span>Login: <strong className="text-foreground font-mono">{login}</strong></span>
            </div>
            {feedback && (
              <p className="text-[11px] text-primary mt-1 font-semibold animate-in fade-in">{feedback}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleRetry}
            disabled={isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Reconnect Master
          </button>
        </div>
      </div>
    );
  }

  const details = getFriendlyErrorDetails(provisioningError);

  return (
    <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs animate-in fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-destructive shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">{details.title}</h3>
          <p className="text-xs text-destructive font-medium mt-1 leading-relaxed">
            {details.message}
          </p>
          {details.suggestion && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <strong className="text-foreground/75 font-semibold">Suggested Action:</strong> {details.suggestion}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
            <span>Server: <strong className="text-foreground font-mono">{server || 'Unknown'}</strong></span>
            <span>&bull;</span>
            <span>Login: <strong className="text-foreground font-mono">{login}</strong></span>
          </div>
          {feedback && (
            <p className="text-[11px] text-primary mt-1 font-semibold animate-in fade-in">{feedback}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          onClick={handleRetry}
          disabled={isPending}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Retry Connection
        </button>
      </div>
    </div>
  );
}
