'use client';

import { useState } from 'react';
import { X, Server, ShieldCheck, Key, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createMt5Account } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';
import { BrokerCombobox } from './broker-combobox';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'MASTER' | 'SUB';
}

export function ConnectAccountModal({ isOpen, onClose, defaultRole = 'SUB' }: ConnectAccountModalProps) {
  const router = useRouter();
  const [role, setRole] = useState<'MASTER' | 'SUB'>(defaultRole);
  const [isDemo, setIsDemo] = useState(true); // Default to Demo for safety
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const login = formData.get('login') as string;
    const broker = formData.get('broker') as string;
    const server = formData.get('server') as string;
    const password = formData.get('password') as string;

    const res = await createMt5Account({ login, broker, server, password, role, isDemo });
    
    setLoading(false);
    
    if (res.success) {
      router.refresh();
      onClose();
    } else {
      setError(res.error || 'Failed to connect account');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto py-4 sm:py-8 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md plaiz-card bg-card rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-border/30">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border/20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Connect Account</h2>
            <p className="text-xs text-muted-foreground mt-1">Link an MT5 terminal to your portfolio.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6" autoComplete="off">
          
          {/* Role Selection */}
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setRole('MASTER')}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                role === 'MASTER' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Master Source
            </button>
            <button
              type="button"
              onClick={() => setRole('SUB')}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                role === 'SUB' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sub Account
            </button>
          </div>

          {/* Account Type (Demo / Live) */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Account Type</label>
            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setIsDemo(true)}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                  isDemo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => setIsDemo(false)}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                  !isDemo ? "bg-card text-destructive shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Live
              </button>
            </div>
            {!isDemo && (
              <p className="text-[11px] text-destructive/80 px-1">
                ⚠ Live accounts will execute real trades. Ensure your API settings are correct.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <BrokerCombobox />

            {/* Login */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Login ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="text" 
                  name="login"
                  required
                  autoComplete="off"
                  placeholder="MT5 Account Number" 
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all font-mono"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Key className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="password" 
                  name="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••" 
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {error && <div className="text-destructive text-sm text-center">{error}</div>}

          <div className="mt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Connect {role === 'MASTER' ? 'Master' : 'Account'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
