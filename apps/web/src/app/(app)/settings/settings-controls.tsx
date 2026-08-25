'use client';

import { useCurrency } from '@/components/currency-provider';
import { useTheme } from 'next-themes';
import { Globe, Moon, Sun, Monitor, Check, Mail, Lock, ShieldCheck, Key } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SettingsControls({ email }: { email?: string }) {
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

  return (
    <div className="flex flex-col gap-10">
      
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
