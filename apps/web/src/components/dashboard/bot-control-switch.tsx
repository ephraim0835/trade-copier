'use client';

import React, { useState } from 'react';
import { Play, Square, Pause, ShieldAlert, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toggleBotStatus } from '@/app/actions/account-actions';
import { useRouter } from 'next/navigation';

interface BotControlSwitchProps {
  initialBotStopped: boolean;
  activeAccountsCount: number;
}

export function BotControlSwitch({
  initialBotStopped,
  activeAccountsCount,
}: BotControlSwitchProps) {
  const router = useRouter();
  const [isStopped, setIsStopped] = useState(initialBotStopped);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = async (targetActive: boolean) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await toggleBotStatus(targetActive);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update bot state.');
      }
      setIsStopped(res.botStopped ?? !targetActive);
      setShowConfirmModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with bot manager.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md p-2 pl-3.5 pr-2 rounded-2xl border border-border/50 shadow-sm">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {!isStopped ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
              </>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 relative" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wider uppercase text-foreground leading-tight flex items-center gap-1">
              {!isStopped ? (
                <span className="text-emerald-500 font-extrabold">Bot Running</span>
              ) : (
                <span className="text-amber-500 font-extrabold">Bot Stopped</span>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              {!isStopped ? `${activeAccountsCount} active follower${activeAccountsCount === 1 ? '' : 's'}` : 'Copying paused'}
            </span>
          </div>
        </div>

        {/* Toggle Button */}
        {!isStopped ? (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 transition-all disabled:opacity-50 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Square className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Stop Bot</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleToggle(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm shadow-emerald-500/20"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Resume Bot</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border/60 max-w-sm w-full rounded-[24px] p-6 shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">Stop Automated Copier?</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Pausing the bot stops trade copying immediately across all your MT5 terminals. Existing open positions will remain open unless manually closed.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-[11px] font-medium text-center">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all border border-border/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggle(false)}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
