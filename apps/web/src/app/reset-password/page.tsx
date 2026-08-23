'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resetPassword } from '@/app/actions/email-auth-actions';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const getStrength = (p: string) => {
    let s = 0;
    if (p.length > 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const strength = getStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] || '';
  const strengthColor = strength <= 1 ? 'bg-destructive' : strength === 2 ? 'bg-amber-500' : 'bg-emerald-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (strength < 2) {
      setError('Please choose a stronger password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await resetPassword(token, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-destructive">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm">Request new link</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

      <Link href="/login" className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-12 w-auto mx-auto mb-6" />
        </div>

        {!success ? (
          <div className="plaiz-card bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] p-10 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Set new password</h1>
              <p className="text-muted-foreground text-[13px]">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="appearance-none rounded-xl w-full px-4 py-3 pl-11 pr-11 border border-border/50 placeholder-muted-foreground text-foreground bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} rounded-full transition-all duration-300`} style={{ width: `${(strength / 4) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{strengthLabel}</p>
                </div>
              )}

              {/* Confirm password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="appearance-none rounded-xl w-full px-4 py-3 pl-11 border border-border/50 placeholder-muted-foreground text-foreground bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                />
              </div>

              {error && <p className="text-destructive text-[13px]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full plaiz-btn plaiz-btn-primary h-12 rounded-2xl font-semibold text-[15px] disabled:opacity-60 mt-2"
              >
                {loading ? 'Saving...' : 'Set New Password'}
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
              <h2 className="text-xl font-bold text-foreground mb-2">Password updated!</h2>
              <p className="text-muted-foreground text-[14px]">Redirecting you to login...</p>
            </div>
            <Link href="/login" className="inline-block plaiz-btn plaiz-btn-primary px-8 py-3 rounded-2xl">
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
