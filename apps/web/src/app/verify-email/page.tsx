'use client';

import { useState, useEffect } from 'react';
import { sendVerification } from '@/app/actions/email-auth-actions';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Email stored in session storage during signup
  const email = typeof window !== 'undefined' 
    ? sessionStorage.getItem('signup_email') || '' 
    : '';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    if (!email || timer > 0) return;
    setLoading(true);
    await sendVerification(email);
    setResent(true);
    setTimer(60); // 60 seconds cooldown
    setLoading(false);
    
    // Hide the success message after 5 seconds but keep the timer running
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      <div className="w-full max-w-md text-center space-y-8">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Mail className="w-10 h-10 text-primary" />
        </div>

        {/* Content */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">
            Check your inbox
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            We sent a verification link to{' '}
            {email ? (
              <span className="text-foreground font-medium">{email}</span>
            ) : (
              'your email address'
            )}
            . Click it to activate your account.
          </p>
        </div>

        {/* Card */}
        <div className="plaiz-card bg-card/50 border border-border/50 rounded-2xl p-6 text-left space-y-3">
          <p className="text-[13px] font-semibold text-foreground">Didn't get it?</p>
          <ul className="text-[13px] text-muted-foreground space-y-1.5">
            <li>• Check your spam or junk folder</li>
            <li>• Make sure you used the right email</li>
            <li>• It can take up to 2 minutes to arrive</li>
          </ul>
        </div>

        {/* Resend */}
        <div className="space-y-4">
          {!resent ? (
            <button
              onClick={handleResend}
              disabled={loading || !email || timer > 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border/50 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Sending...' : timer > 0 ? `Resend again in ${timer}s` : 'Resend verification email'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-500 text-[14px] font-medium py-3">
              <CheckCircle className="w-4 h-4" />
              Email resent!
            </div>
          )}
          
          {timer > 0 && !resent && (
            <p className="text-[12px] text-muted-foreground text-center">
              Please wait before requesting another email.
            </p>
          )}
        </div>

        <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
