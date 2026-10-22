'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { confirmVerification } from '@/app/actions/email-auth-actions';
import { signIn } from 'next-auth/react';
import { CheckCircle, XCircle, Loader2, Sparkles, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const expParam = searchParams.get('exp');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Check initial token and expiration
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check your verification link.');
      return;
    }

    if (expParam) {
      const expMs = parseInt(expParam, 10);
      if (!isNaN(expMs) && Date.now() > expMs) {
        setStatus('error');
        setIsExpired(true);
        setMessage('This verification link has expired (links are valid for 15 minutes). Please request a fresh link.');
        return;
      }
    }

    confirmVerification(token).then(async (result) => {
      if (result.error) {
        setStatus('error');
        setMessage(result.error);
        setIsExpired(!!result.isExpired || result.error.toLowerCase().includes('expired'));
      } else {
        if (result.alreadyVerified) {
          setAlreadyVerified(true);
        }

        // Auto-login user with the one-time token
        if (result.email && result.oneTimeToken) {
          try {
            await signIn('credentials', {
              redirect: false,
              email: result.email,
              oneTimeToken: result.oneTimeToken,
            });
          } catch (e) {
            console.error('Auto sign-in error:', e);
          }
        }

        setStatus('success');
      }
    });
  }, [token, expParam]);

  // Handle 3-second redirect countdown on verification success
  useEffect(() => {
    if (status !== 'success') return;

    if (redirectCountdown <= 0) {
      window.location.href = '/dashboard';
      return;
    }

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/dashboard';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, redirectCountdown]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      <div className="w-full max-w-md text-center space-y-6">
        {status === 'loading' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-secondary/50 border border-border/50 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verifying your email...</h1>
              <p className="text-muted-foreground text-[14px]">
                Validating your 15-minute token and activating your 5-day free trial.
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-400">
            {/* Success Icon */}
            <div className="mx-auto w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center relative shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <Sparkles className="w-5 h-5 text-emerald-400 absolute -top-1 -right-1 animate-bounce" />
            </div>

            {/* Trial Activated Badge */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-bold flex items-center justify-center gap-2 text-center">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>5-Day Free Trial Activated (5 Trading Days • Weekends Excluded)</span>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-foreground mb-2">
                {alreadyVerified ? 'Account Already Verified!' : 'Email Verified Successfully!'}
              </h1>
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                {alreadyVerified
                  ? 'Your account is verified and ready. Directing you to your active dashboard...'
                  : 'Welcome to Plaiz Markets! Your account is active and your 5-day free trial is now running. Saturdays and Sundays do not count against your trial duration.'}
              </p>
            </div>

            {/* Redirect notice widget */}
            <div className="plaiz-card bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Redirecting to Dashboard
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Taking you to your workspace in <span className="font-mono font-bold text-primary">{redirectCountdown}s</span>...
                  </p>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>

            {/* Manual Immediate Action */}
            <button
              type="button"
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              className="plaiz-btn plaiz-btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-primary/25 cursor-pointer"
            >
              <span>Go to Dashboard Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === 'error' && isExpired && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <Clock className="w-10 h-10 text-destructive animate-pulse" />
            </div>

            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
              ⏳ 15-Minute Link Window Expired
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verification Link Expired</h1>
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                For your account security, email verification links expire after 15 minutes. 
                Please request a fresh link below to activate your 5-day free trial.
              </p>
            </div>

            <Link 
              href="/verify-email" 
              className="plaiz-btn plaiz-btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-md shadow-primary/20"
            >
              <span>Request Fresh Verification Link</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors pt-2">
              ← Return to login
            </Link>
          </div>
        )}

        {status === 'error' && !isExpired && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verification Failed</h1>
              <p className="text-muted-foreground text-[14px] leading-relaxed">{message}</p>
            </div>
            <Link 
              href="/verify-email" 
              className="plaiz-btn plaiz-btn-secondary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold"
            >
              <span>Request New Link</span>
            </Link>
            <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors pt-2">
              ← Return to login
            </Link>
          </div>
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
