'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { retryAccountConnection } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';

interface MasterStatusAlertProps {
  accountId: string;
  login: string;
  server?: string | null;
  connectionStatus?: string | null;
  provisioningError?: string | null;
}

export function MasterStatusAlert({
  accountId,
  login,
  server,
  connectionStatus,
  provisioningError,
}: MasterStatusAlertProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const isFailed = connectionStatus === 'FAILED' || !!provisioningError;
  const isProvisioning = connectionStatus === 'PROVISIONING';

  if (!isFailed && !isProvisioning) return null;

  function handleRetry() {
    startTransition(async () => {
      setFeedback(null);
      const res = await retryAccountConnection(accountId);
      if (res.success) {
        setFeedback('Retry initiated. Re-establishing MT5 link...');
        router.refresh();
      } else {
        setFeedback(res.error || 'Failed to retry connection');
      }
    });
  }

  if (isProvisioning) {
    return (
      <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 text-xs text-primary animate-in fade-in">
        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
        <div>
          <span className="font-bold text-foreground block text-sm">Provisioning Master MT5 Terminal...</span>
          <p className="text-muted-foreground text-xs mt-0.5">
            Spinning up dedicated portable instance and authenticating with broker server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs animate-in fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-destructive shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">Master Connection Error Detected</h3>
          <p className="text-xs text-destructive font-mono font-medium mt-1 leading-relaxed">
            {provisioningError || 'Broker or MT5 server rejected credentials. Verify login, password, and server.'}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5 font-mono">
            <span>Server: <strong className="text-foreground">{server || 'Unknown'}</strong></span>
            <span>&bull;</span>
            <span>Login: <strong className="text-foreground">{login}</strong></span>
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
