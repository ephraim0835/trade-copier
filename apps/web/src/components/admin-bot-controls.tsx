'use client';

import { useState } from 'react';
import { Play, RotateCcw, RefreshCw, AlertCircle, CheckCircle2, Terminal, Info, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BotControlsProps {
  initialIsOnline?: boolean;
  vpsName?: string;
  lastCommand?: string | null;
  commandStatus?: string | null;
  commandMessage?: string | null;
  commandAt?: string | null;
}

export function AdminBotControls({
  initialIsOnline = false,
  vpsName = 'vps-main-1',
  lastCommand = null,
  commandStatus = null,
  commandMessage = null,
  commandAt = null,
}: BotControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cmdInfo, setCmdInfo] = useState({
    lastCommand,
    commandStatus,
    commandMessage,
    commandAt,
  });

  async function handleCommand(cmd: 'START' | 'RESTART' | 'SYNC') {
    setLoading(cmd);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/bot-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch command');
      }

      setFeedback({
        type: 'success',
        message: data.message || `Command ${cmd} dispatched successfully!`,
      });

      if (data.vps) {
        setCmdInfo({
          lastCommand: data.vps.lastCommand || cmd,
          commandStatus: data.vps.commandStatus || 'PENDING',
          commandMessage: data.vps.commandMessage || data.message,
          commandAt: new Date().toISOString(),
        });
      }

      // Revalidate page data
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error executing command',
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Host Engine Command Center
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Signals transmit directly to host VPS daemon via real-time DB queue
        </span>
      </div>

      {/* 3-Column Action & Definition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* START BOT ENGINE */}
        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Cold Boot & Wake
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground">Start Bot Engine</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Awakens the host VPS daemon, un-freezes backoff loops, resets failed accounts to pending, and initializes all active MT5 instances.
            </p>
            <div className="pt-2 border-t border-border/25 text-[10px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">When to use:</strong> If bot telemetry shows OFFLINE, after restarting the host PC, or when turning the system back on.
            </div>
          </div>
          <button
            onClick={() => handleCommand('START')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${loading === 'START' ? 'animate-spin' : ''}`} />
            {loading === 'START' ? 'Starting...' : 'Start Bot Engine'}
          </button>
        </div>

        {/* RESTART FLEET */}
        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                Fleet Reboot & Repair
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground">Restart Fleet</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Force-terminates all running terminal64 processes, flushes memory leaks, re-patches WebRequest URL permissions in common.ini, and cold-boots fresh.
            </p>
            <div className="pt-2 border-t border-border/25 text-[10px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">When to use:</strong> If any terminal freezes, RAM usage climbs abnormally, or network WebRequests become unresponsive.
            </div>
          </div>
          <button
            onClick={() => handleCommand('RESTART')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 active:scale-95 transition-all disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading === 'RESTART' ? 'animate-spin' : ''}`} />
            {loading === 'RESTART' ? 'Restarting Fleet...' : 'Restart Fleet'}
          </button>
        </div>

        {/* FORCE SYNC TERMINALS */}
        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 hover:border-primary/40 transition-all flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                Fast DB Scan
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground">Force Sync Terminals</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Immediately scans the database for new accounts or updated passwords without stopping healthy terminals. Bypasses the 10-second polling interval.
            </p>
            <div className="pt-2 border-t border-border/25 text-[10px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">When to use:</strong> Right after adding a new account, correcting a password typo, or enabling/disabling a copier.
            </div>
          </div>
          <button
            onClick={() => handleCommand('SYNC')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-secondary/80 hover:bg-secondary text-foreground border border-border/50 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading === 'SYNC' ? 'animate-spin' : ''}`} />
            {loading === 'SYNC' ? 'Syncing...' : 'Force Sync Terminals'}
          </button>
        </div>
      </div>

      {/* Live Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border animate-in fade-in slide-in-from-top-1 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Daemon Command Pipeline Telemetry */}
      {cmdInfo.lastCommand && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>
              Last Signal: <strong className="text-foreground font-mono">{cmdInfo.lastCommand}</strong>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                cmdInfo.commandStatus === 'EXECUTED'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : cmdInfo.commandStatus === 'EXECUTING'
                  ? 'bg-amber-500/10 text-amber-500 animate-pulse'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {cmdInfo.commandStatus || 'QUEUED'}
            </span>
          </div>
          {cmdInfo.commandMessage && (
            <span className="truncate max-w-md italic opacity-90 text-[11px] font-mono">
              "{cmdInfo.commandMessage}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
