'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function VerifyClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get('status');
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  const [state, setState] = useState<'VERIFYING' | 'SUCCESS' | 'FAILED'>('VERIFYING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'cancelled') {
      setState('FAILED');
      setErrorMsg('Payment was cancelled. You have not been charged.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/billing/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: transactionId,
            tx_ref: txRef,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Payment verification could not be confirmed.');
        }

        setPlanId(data.subscription?.planId || 'pro');
        setState('SUCCESS');
      } catch (err: any) {
        console.error('Verify error:', err);
        setErrorMsg(err.message || 'Payment could not be verified.');
        setState('FAILED');
      }
    }

    verify();
  }, [status, txRef, transactionId]);

  return (
    <div className="plaiz-card max-w-lg w-full p-8 md:p-10 rounded-3xl border border-border/50 text-center flex flex-col items-center">
      {state === 'VERIFYING' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <h2 className="text-xl font-bold text-foreground">Confirming Your Subscription</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            We are confirming your payment with Flutterwave. Please keep this window open for just a moment...
          </p>
        </div>
      )}

      {state === 'SUCCESS' && (
        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            Payment Verified
          </span>
          <h2 className="text-2xl font-bold text-foreground">Subscription Activated!</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Your <span className="font-semibold text-foreground uppercase">{planId || 'Pro'}</span> plan is now active. All trade copying features and multi-account sync are unlocked.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <Link
              href="/dashboard"
              className="plaiz-btn plaiz-btn-primary w-full justify-center py-3"
            >
              Go to Live Dashboard
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
            <Link
              href="/risk"
              className="plaiz-btn plaiz-btn-secondary w-full justify-center py-3"
            >
              Set Risk Controls
            </Link>
          </div>
        </div>
      )}

      {state === 'FAILED' && (
        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-2">
            <XCircle className="w-10 h-10" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            Not Completed
          </span>
          <h2 className="text-2xl font-bold text-foreground">Payment Unsuccessful</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            {errorMsg || 'We could not confirm your payment. If you were charged, please contact support and your subscription will be credited immediately.'}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <Link
              href="/pricing"
              className="plaiz-btn plaiz-btn-primary w-full justify-center py-3"
            >
              Back to Plans
            </Link>
            <Link
              href="/dashboard"
              className="plaiz-btn plaiz-btn-secondary w-full justify-center py-3"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
