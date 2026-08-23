'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/app/actions/email-auth-actions';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      {/* Back */}
      <Link href="/login" className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-12 w-auto mx-auto mb-6" />
        </div>

        {!sent ? (
          <div className="plaiz-card bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] p-10 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Forgot password?</h1>
              <p className="text-muted-foreground text-[13px]">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="appearance-none rounded-xl w-full px-4 py-3 pl-11 border border-border/50 placeholder-muted-foreground text-foreground bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full plaiz-btn plaiz-btn-primary h-12 rounded-2xl font-semibold text-[15px] disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        ) : (
          <div className="plaiz-card bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] p-10 text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50" />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Check your inbox</h2>
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                If an account exists for <span className="text-foreground font-medium">{email}</span>, 
                we've sent a password reset link. It expires in 1 hour.
              </p>
            </div>
            <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              ← Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
