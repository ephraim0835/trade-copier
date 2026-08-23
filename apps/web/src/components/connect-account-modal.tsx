'use client';

import { useState } from 'react';
import { X, Server, ShieldCheck, Key, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'MASTER' | 'SUB';
}

export function ConnectAccountModal({ isOpen, onClose, defaultRole = 'SUB' }: ConnectAccountModalProps) {
  const [role, setRole] = useState<'MASTER' | 'SUB'>(defaultRole);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call for the demo
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md surface-matte rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-border/30">
        
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
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
          
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

          <div className="flex flex-col gap-4">
            {/* Broker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Broker</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Server className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. MetaQuotes-Demo" 
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Login */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Login ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <input 
                  type="text" 
                  required
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
                  required
                  placeholder="••••••••" 
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

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
