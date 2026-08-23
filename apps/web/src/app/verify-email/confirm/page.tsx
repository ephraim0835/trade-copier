'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { confirmVerification } from '@/app/actions/email-auth-actions';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    confirmVerification(token).then((result) => {
      if (result.error) {
        setStatus('error');
        setMessage(result.error);
      } else {
        setStatus('success');
        // Redirect to login after 3 seconds
        setTimeout(() => router.push('/login?verified=1'), 3000);
      }
    });
  }, [token, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      <div className="w-full max-w-md text-center space-y-6">
        {status === 'loading' && (
          <>
            <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verifying your email...</h1>
              <p className="text-muted-foreground text-[15px]">Just a moment.</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Email verified!</h1>
              <p className="text-muted-foreground text-[15px]">
                Your account is now active. Redirecting you to login...
              </p>
            </div>
            <Link href="/login" className="inline-block plaiz-btn plaiz-btn-primary px-8 py-3 rounded-2xl">
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verification failed</h1>
              <p className="text-muted-foreground text-[15px]">{message}</p>
            </div>
            <Link href="/verify-email" className="inline-block plaiz-btn plaiz-btn-secondary px-8 py-3 rounded-2xl">
              Request new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}
