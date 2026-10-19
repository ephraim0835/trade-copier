'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Server, ShieldCheck, Key, User, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Crown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createMt5Account, getAccountConnectionStatus } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';
import { BrokerCombobox } from './broker-combobox';
import { formatUserFriendlyError, getFriendlyErrorDetails } from '@/lib/error-formatter';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'MASTER' | 'SUB';
}

type ModalStep = 'FORM' | 'CONNECTING' | 'SUCCESS' | 'ERROR';

export function ConnectAccountModal({ isOpen, onClose, defaultRole = 'SUB' }: ConnectAccountModalProps) {
  const router = useRouter();
  const [role, setRole] = useState<'MASTER' | 'SUB'>(defaultRole);
  const [isDemo, setIsDemo] = useState(false);
  const [step, setStep] = useState<ModalStep>('FORM');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form values preserved across retries
  const [loginVal, setLoginVal] = useState('');
  const [brokerVal, setBrokerVal] = useState('');
  const [serverVal, setServerVal] = useState('');
  const [passwordVal, setPasswordVal] = useState('');

  // Live polling state
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [connectedAccountData, setConnectedAccountData] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep('FORM');
      setLoading(false);
      setErrorMessage(null);
      setCreatedAccountId(null);
      setConnectedAccountData(null);
      setElapsedSeconds(0);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
  }, [isOpen]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const startPolling = (accountId: string) => {
    setElapsedSeconds(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    
    // Poll every 2 seconds
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await getAccountConnectionStatus(accountId);
        if (res.success && res.account) {
          const acc = res.account;
          
          if (acc.connectionStatus === 'ONLINE') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            setConnectedAccountData(acc);
            setStep('SUCCESS');
            router.refresh();
          } else if (acc.connectionStatus === 'FAILED') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            setErrorMessage(formatUserFriendlyError(acc.provisioningError || 'Broker or MT5 server rejected the connection credentials.'));
            setStep('ERROR');
          }
        }
      } catch (err: any) {
        console.error('Error polling connection status:', err);
      }
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    
    const formData = new FormData(e.currentTarget);
    const login = (formData.get('login') as string)?.trim();
    const broker = (formData.get('broker') as string)?.trim();
    const server = (formData.get('server') as string)?.trim();
    const password = formData.get('password') as string;

    setLoginVal(login);
    setBrokerVal(broker);
    setServerVal(server);
    setPasswordVal(password);

    const res = await createMt5Account({ login, broker, server, password, role, isDemo });
    
    setLoading(false);
    
    if (res.success && res.account) {
      setCreatedAccountId(res.account.id);
      setStep('CONNECTING');
      startPolling(res.account.id);
    } else {
      setErrorMessage(formatUserFriendlyError(res.error || 'Failed to register account'));
      setStep('ERROR');
    }
  };

  const handleDone = () => {
    router.refresh();
    onClose();
  };

  const handleTryAgain = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setStep('FORM');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto py-4 sm:py-8 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={step === 'CONNECTING' ? handleDone : onClose}
      />
      
      <div className="relative w-full max-w-md plaiz-card bg-card rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-border/30">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border/20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {step === 'FORM' && 'Connect Account'}
              {step === 'CONNECTING' && 'Connecting to MT5...'}
              {step === 'SUCCESS' && 'Connection Successful!'}
              {step === 'ERROR' && 'Connection Failed'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 'FORM' && 'Link an MT5 terminal to your portfolio.'}
              {step === 'CONNECTING' && 'Launching terminal and initializing Trade Copier EA.'}
              {step === 'SUCCESS' && 'Your account is live and ready for trade copying.'}
              {step === 'ERROR' && 'Review the issue below and adjust your credentials.'}
            </p>
          </div>
          <button 
            onClick={step === 'CONNECTING' ? handleDone : onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* STEP 1: FORM */}
        {step === 'FORM' && (
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
                <p className="text-[11px] text-destructive/80 px-1 font-medium">
                  ⚠ Live accounts execute real trades. Ensure risk parameters fit your balance.
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
                    defaultValue={loginVal}
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
                    defaultValue={passwordVal}
                    autoComplete="new-password"
                    placeholder="••••••••" 
                    className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-left flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formatUserFriendlyError(errorMessage)}</span>
              </div>
            )}

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
        )}

        {/* STEP 2: CONNECTING / LOADING SCREEN */}
        {step === 'CONNECTING' && (
          <div className="p-8 flex flex-col items-center gap-6 text-center animate-in fade-in duration-300">
            {/* Animated Pulsing Ring */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
              <div className="relative w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-lg text-foreground">
                {role === 'MASTER' ? 'Linking Master Terminal' : 'Linking Sub Account Terminal'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Connecting to broker server: <span className="font-mono text-foreground font-medium">{serverVal || 'MT5 Server'}</span>
              </p>
            </div>

            {/* Visual Step Timeline */}
            <div className="w-full bg-black/5 dark:bg-white/5 border border-border/20 rounded-2xl p-4 flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-foreground">Account registered & encrypted</span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span className="font-medium text-foreground">Provisioning MT5 sandbox instance</span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  elapsedSeconds > 8 ? "bg-primary/20 text-primary" : "bg-black/10 dark:bg-white/10 text-muted-foreground"
                )}>
                  {elapsedSeconds > 8 ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  )}
                </div>
                <span className={cn(
                  "font-medium",
                  elapsedSeconds > 8 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {role === 'MASTER' ? 'Attaching MasterCopier EA & establishing heartbeat' : 'Attaching SubCopier EA & establishing heartbeat'}
                </span>
              </div>
            </div>

            {/* Connection Status & Background Reassurance Card */}
            <div className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/30 text-xs text-left flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Connecting to broker...
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">{elapsedSeconds}s</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Broker trade server initialization typically takes 30–60 seconds. You can safely close this screen at any time—your terminal will activate automatically in the background.
              </p>
              <button
                type="button"
                onClick={handleDone}
                className="mt-1 text-xs font-semibold text-primary hover:underline self-start flex items-center gap-1 transition-colors"
              >
                Continue to Dashboard in background &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS SCREEN */}
        {step === 'SUCCESS' && (
          <div className="p-8 flex flex-col items-center gap-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-xl text-foreground">Terminal Online & Ready</h3>
              <p className="text-xs text-muted-foreground">
                Successfully authenticated with <span className="text-foreground font-semibold">{brokerVal || 'broker'}</span>
              </p>
            </div>

            <div className="w-full bg-black/5 dark:bg-white/5 border border-border/20 rounded-2xl p-4 flex flex-col gap-2.5 text-left text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-semibold">Login ID</span>
                <span className="font-mono font-bold text-foreground">{loginVal}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-semibold">Server</span>
                <span className="font-mono text-foreground">{serverVal}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-semibold">Role</span>
                <span className="font-semibold text-primary">{role === 'MASTER' ? 'Master Source' : 'Sub Copier'}</span>
              </div>
              {connectedAccountData?.equity !== undefined && connectedAccountData.equity > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-semibold">Live Equity</span>
                  <span className="font-mono font-bold text-emerald-500">
                    ${connectedAccountData.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            <button 
              type="button"
              onClick={handleDone}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <span>View in Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: ERROR SCREEN */}
        {step === 'ERROR' && (() => {
          const details = getFriendlyErrorDetails(errorMessage);
          return (
            <div className="p-8 flex flex-col items-center gap-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center text-destructive shadow-lg shadow-destructive/20">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-bold text-xl text-foreground">{details.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {details.isPlanLimit 
                    ? 'Upgrade your plan to increase account capacity and connect more MT5 terminals.'
                    : 'The terminal could not establish an active session with your broker.'}
                </p>
              </div>

              <div className="w-full bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-left flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="font-semibold uppercase text-[10px] tracking-widest text-destructive/80 shrink-0 mt-0.5">Notice:</span>
                  <p className="text-xs text-destructive font-medium leading-relaxed">
                    {details.message}
                  </p>
                </div>
                {details.suggestion && (
                  <div className="pt-2 border-t border-destructive/15 text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/80 font-semibold">Suggested Fix:</strong> {details.suggestion}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 w-full">
                {details.isPlanLimit ? (
                  <Link
                    href="/pricing"
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                  >
                    <Crown className="w-4 h-4" />
                    <span>View Pricing Plans & Upgrade</span>
                  </Link>
                ) : (
                  <button 
                    type="button"
                    onClick={handleTryAgain}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Edit Credentials & Try Again</span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={handleDone}
                  className="w-full py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel & Close
                </button>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

