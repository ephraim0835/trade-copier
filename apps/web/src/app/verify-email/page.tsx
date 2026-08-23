'use client';

import { useState } from 'react';
import { sendVerification } from '@/app/actions/email-auth-actions';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Email stored in session storage during signup
  const email = typeof window !== 'undefined' 
    ? sessionStorage.getItem('signup_email') || '' 
    : '';

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    await sendVerification(email);
    setResent(true);
    setLoading(false);
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
        {!resent ? (
          <button
            onClick={handleResend}
            disabled={loading || !email}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border/50 text-[14px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Sending...' : 'Resend verification email'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-500 text-[14px] font-medium">
            <CheckCircle className="w-4 h-4" />
            Email resent!
          </div>
        )}

        <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
