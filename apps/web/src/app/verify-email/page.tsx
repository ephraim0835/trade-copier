'use client';

import { useState, useEffect } from 'react';
import { sendVerification } from '@/app/actions/email-auth-actions';
import { Mail, RefreshCw, CheckCircle, Clock, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkTimer, setLinkTimer] = useState(15 * 60); // 15 Minutes = 900s

  // Email stored in session storage during signup
  const email = typeof window !== 'undefined' 
    ? sessionStorage.getItem('signup_email') || '' 
    : '';

  // Track 15-minute expiration timestamp in sessionStorage and sync with clock
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedExpiry = sessionStorage.getItem('verification_link_expiry');
    const now = Date.now();

    if (!storedExpiry) {
      const expiryTime = now + 15 * 60 * 1000;
      sessionStorage.setItem('verification_link_expiry', expiryTime.toString());
      storedExpiry = expiryTime.toString();
    }

    const updateRemaining = () => {
      const expiry = sessionStorage.getItem('verification_link_expiry');
      if (expiry) {
        const remainingSec = Math.max(0, Math.floor((parseInt(expiry, 10) - Date.now()) / 1000));
        setLinkTimer(remainingSec);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setLoading(true);
    const res = await sendVerification(email);
    setResent(true);
    setCooldown(60); // 60 seconds button cooldown
    
    // Reset 15 minute timer with server timestamp or fallback
    const newExpiry = res?.expiresAt || (Date.now() + 15 * 60 * 1000);
    sessionStorage.setItem('verification_link_expiry', newExpiry.toString());
    setLinkTimer(15 * 60);
    
    setLoading(false);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
          <Mail className="w-10 h-10 text-primary" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse border-2 border-background" />
        </div>

        {/* 5-Day Free Trial Notice Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center justify-center gap-2 text-center">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>5-Day Free Trial Ready (5 Full Trading Days • Weekends Excluded)</span>
        </div>

        {/* Content */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Check your inbox
          </h1>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            We sent a verification link to{' '}
            {email ? (
              <span className="text-foreground font-semibold">{email}</span>
            ) : (
              'your email address'
            )}
            . Click it within 15 minutes to activate your account.
          </p>
        </div>

        {/* 15-Minute Countdown Timer Widget */}
        <div className="plaiz-card bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-left">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              linkTimer > 60 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive animate-pulse'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                Link Expiration
              </p>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                {linkTimer > 0 ? (
                  <>
                    <span>Expires in</span>
                    <span className="font-mono text-primary font-extrabold text-base tracking-wider">
                      {formatTime(linkTimer)}
                    </span>
                  </>
                ) : (
                  <span className="text-destructive font-semibold">Link has expired</span>
                )}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wider">
              15m Window
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="plaiz-card bg-card/40 border border-border/40 rounded-2xl p-5 text-left space-y-2.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-[13px]">Helpful tips:</p>
          <ul className="space-y-1.5">
            <li>• Check your spam or promotions folder</li>
            <li>• The link is valid for 15 minutes from request</li>
            <li>• If expired, click the resend button below for a new link</li>
          </ul>
        </div>

        {/* Resend */}
        <div className="space-y-3">
          {!resent ? (
            <button
              onClick={handleResend}
              disabled={loading || !email || cooldown > 0}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-bold transition-all disabled:opacity-50 ${
                linkTimer === 0 
                  ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-md shadow-primary/20' 
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading 
                ? 'Sending fresh link...' 
                : cooldown > 0 
                ? `Resend available in ${cooldown}s` 
                : linkTimer === 0 
                ? 'Resend fresh verification link' 
                : 'Resend verification email'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-500 text-[14px] font-bold py-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
              Fresh verification link sent!
            </div>
          )}
        </div>

        <Link href="/login" className="block text-[13px] text-muted-foreground hover:text-foreground transition-colors pt-2">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
