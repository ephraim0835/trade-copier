'use client';

import { useCurrency } from '@/components/currency-provider';
import { useTheme } from 'next-themes';
import { Globe, Moon, Sun, Monitor, Check, Mail, Lock, ShieldCheck, Key, CreditCard, Sparkles, CheckCircle2, ArrowUpRight, BarChart3, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckoutButton } from '@/components/checkout-button';

interface SettingsControlsProps {
  email?: string;
  subscription?: {
    status: string;
    planId: string | null;
    currentPeriodEnd: string | null;
    flutterwaveTxRef: string | null;
  } | null;
  role?: string;
  mastersCount?: number;
  subsCount?: number;
}

export function SettingsControls({ 
  email, 
  subscription, 
  role,
  mastersCount = 0,
  subsCount = 0,
}: SettingsControlsProps) {
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [passwordState, setPasswordState] = useState<'IDLE' | 'REQUESTING' | 'CODE_SENT' | 'CONFIRMING' | 'SUCCESS'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const requestPasswordReset = async () => {
    if (timer > 0) return;
    setPasswordState('REQUESTING');
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/reset-password/request', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send code');
      setPasswordState('CODE_SENT');
      setTimer(60);
    } catch (err: any) {
      setErrorMsg(err.message);
      setPasswordState('IDLE');
    }
  };

  const confirmPasswordReset = async () => {
    if (!resetCode || !newPassword) {
      setErrorMsg('Please enter both code and new password.');
      return;
    }
    setPasswordState('CONFIRMING');
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode, newPassword })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update password');
      }
      setPasswordState('SUCCESS');
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message);
      setPasswordState('CODE_SENT');
    }
  };

  if (!mounted) return null;

  const currentPlan = (subscription?.planId || 'basic').toLowerCase();
  const maxMasters = currentPlan === 'pro' ? 2 : 1;
  const maxSubs = currentPlan === 'pro' ? 10 : 3;

  return (
    <div className="flex flex-col gap-10">

      {/* SUBSCRIPTION & BILLING */}
      <div className="flex flex-col gap-6 pb-8 border-b border-border/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">Subscription & Billing</h3>
                {subscription?.status === 'ACTIVE' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Active • {(subscription.planId || 'PRO').toUpperCase()}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Free Tier / Inactive
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-lg leading-relaxed">
                Seamlessly power your automated trade execution. Subscriptions are billed monthly with instant activation via Flutterwave (Cards, Bank Transfer, USSD).
              </p>
            </div>
          </div>

          {(role === 'ADMIN' || role === 'OWNER') && (
            <Link
              href="/admin/revenue"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Revenue Tracker
              <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
            </Link>
          )}
        </div>

        {/* Live Quota Capacity Meter */}
        <div className="ml-0 md:ml-14 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/30">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">Master Accounts</span>
              <span className="font-bold text-foreground">{mastersCount} / {maxMasters} Used</span>
            </div>
            <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${mastersCount >= maxMasters ? 'bg-amber-500' : 'bg-primary'}`} 
                style={{ width: `${Math.min(100, (mastersCount / maxMasters) * 100)}%` }} 
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">Sub Accounts</span>
              <span className="font-bold text-foreground">{subsCount} / {maxSubs} Used</span>
            </div>
            <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${subsCount >= maxSubs ? 'bg-amber-500' : 'bg-primary'}`} 
                style={{ width: `${Math.min(100, (subsCount / maxSubs) * 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Current status card */}
        <div className="ml-0 md:ml-14 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plan 1: Basic */}
          <div className={`p-5 rounded-2xl border transition-all ${
            subscription?.status === 'ACTIVE' && subscription?.planId === 'basic'
              ? 'bg-primary/5 border-primary shadow-sm'
              : 'bg-card/40 border-border/40 hover:border-border/80'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Basic Plan</span>
              {subscription?.status === 'ACTIVE' && subscription?.planId === 'basic' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Current Plan
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {currency === 'NGN' ? '₦39,000' : '$26'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">/ month</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              1 Master Account & 3 Sub Accounts. Standard cloud routing with 50ms execution speed.
            </p>
            <CheckoutButton
              planId="basic"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-secondary hover:bg-secondary/80 text-foreground border border-border/50"
            >
              {subscription?.status === 'ACTIVE' && subscription?.planId === 'basic' ? 'Renew Basic Plan' : 'Select Basic Plan'}
            </CheckoutButton>
          </div>

          {/* Plan 2: Pro */}
          <div className={`p-5 rounded-2xl border relative transition-all ${
            subscription?.status === 'ACTIVE' && subscription?.planId === 'pro'
              ? 'bg-primary/10 border-primary shadow-sm'
              : 'bg-card/60 border-primary/30 hover:border-primary/60'
          }`}>
            <div className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3" /> Recommended
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Pro Plan</span>
              {subscription?.status === 'ACTIVE' && subscription?.planId === 'pro' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Current Plan
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {currency === 'NGN' ? '₦58,500' : '$39'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">/ month</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Up to 2 Master Accounts & 10 Sub Accounts. Dedicated low-latency bridge (&lt;15ms) + Advanced Equity Guard.
            </p>
            <CheckoutButton
              planId="pro"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
            >
              {subscription?.status === 'ACTIVE' && subscription?.planId === 'pro' ? 'Renew Pro Plan' : 'Upgrade to Pro'}
            </CheckoutButton>
          </div>
        </div>

        {subscription?.currentPeriodEnd && (
          <div className="ml-0 md:ml-14 flex items-center gap-2 text-xs text-muted-foreground bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-border/20">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span>
              Current billing period ends on{' '}
              <strong className="text-foreground">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>
              .
            </span>
          </div>
        )}
      </div>

      {/* CURRENCY PREFERENCE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Display Currency</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Choose your preferred display currency for all monetary values. Rates are fetched live and applied on the frontend automatically.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0">
          <button
            onClick={() => setCurrency('USD')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${currency === 'USD' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {currency === 'USD' && <Check className="w-3.5 h-3.5" />} USD
          </button>
          <button
            onClick={() => setCurrency('NGN')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${currency === 'NGN' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {currency === 'NGN' && <Check className="w-3.5 h-3.5" />} NGN
          </button>
        </div>
      </div>

      {/* THEME PREFERENCE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Moon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Interface Theme</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Switch between Light Mode and the deep Plaiz Void Dark Mode.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'light' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Sun className="w-4 h-4" /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'dark' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Moon className="w-4 h-4" /> Dark
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${theme === 'system' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Monitor className="w-4 h-4" /> System
          </button>
        </div>
      </div>

      {/* SECURITY PREFERENCES */}
      <div className="flex flex-col gap-6 pt-8 border-t border-border/30">
        <div className="flex items-start gap-4 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Security Settings</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Manage your account credentials securely.
            </p>
          </div>
        </div>

        {/* Email Display */}
        <div className="flex flex-col gap-1.5 ml-14 max-w-sm">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Registered Email</label>
          <div className="relative opacity-60 pointer-events-none">
            <div className="absolute inset-y-0 left-4 flex items-center">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <input 
              type="email" 
              value={email || ''}
              readOnly
              className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-3 pl-11 pr-4 text-sm text-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Password Reset Section */}
        <div className="flex flex-col gap-4 ml-14 max-w-sm">
          <div className="flex items-center justify-between">
             <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Account Password</label>
             {passwordState === 'IDLE' && (
                <button 
                  onClick={requestPasswordReset}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Change Password
                </button>
             )}
          </div>
          
          {passwordState === 'IDLE' && (
            <div className="relative opacity-60 pointer-events-none">
              <div className="absolute inset-y-0 left-4 flex items-center">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input 
                type="password" 
                value="••••••••••••••••"
                readOnly
                className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-3 pl-11 pr-4 text-sm text-foreground focus:outline-none"
              />
            </div>
          )}

          {passwordState === 'REQUESTING' && (
            <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Sending code to your email...
            </div>
          )}

          {(passwordState === 'CODE_SENT' || passwordState === 'CONFIRMING') && (
            <div className="flex flex-col gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-[12px] text-muted-foreground mb-1">
                We sent a 6-digit verification code to your email. Enter it below along with your new password.
              </p>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Key className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="text" 
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-Digit Code"
                  className="w-full bg-background border border-border/50 rounded-lg py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono tracking-widest"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full bg-background border border-border/50 rounded-lg py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={confirmPasswordReset}
                  disabled={passwordState === 'CONFIRMING' || resetCode.length !== 6 || newPassword.length < 6}
                  className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {passwordState === 'CONFIRMING' ? 'Updating...' : 'Update Password'}
                </button>
                <button 
                  onClick={requestPasswordReset}
                  disabled={timer > 0}
                  className="flex-1 bg-black/10 dark:bg-white/5 text-foreground text-xs font-semibold py-2.5 rounded-lg hover:bg-black/20 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                </button>
              </div>

              {errorMsg && <p className="text-xs text-destructive text-center mt-1">{errorMsg}</p>}
            </div>
          )}

          {passwordState === 'SUCCESS' && (
            <div className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              Password updated successfully!
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
