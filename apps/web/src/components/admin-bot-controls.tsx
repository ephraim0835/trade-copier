'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, RefreshCw, AlertCircle, CheckCircle2, Terminal, Loader2, Zap } from 'lucide-react';
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [cmdInfo, setCmdInfo] = useState({
    lastCommand,
    commandStatus,
    commandMessage,
    commandAt,
  });

  const isPollingRef = useRef(false);

  // Synchronize state whenever parent server component updates props
  useEffect(() => {
    if (!isPollingRef.current) {
      setCmdInfo({
        lastCommand: lastCommand ?? null,
        commandStatus: commandStatus ?? null,
        commandMessage: commandMessage ?? null,
        commandAt: commandAt ?? null,
      });
    }
  }, [lastCommand, commandStatus, commandMessage, commandAt]);

  // Background telemetry poller (every 8 seconds when idle)
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      if (isPollingRef.current) return;
      try {
        const res = await fetch('/api/admin/bot-status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.vps) {
          setCmdInfo((prev) => ({
            lastCommand: data.vps.lastCommand ?? prev.lastCommand,
            commandStatus: data.vps.commandStatus ?? prev.commandStatus,
            commandMessage: data.vps.commandMessage ?? prev.commandMessage,
            commandAt: data.vps.commandAt ?? prev.commandAt,
          }));
        }
      } catch (err) {
        // Silently ignore background polling errors
      }
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function handleCommand(cmd: 'START' | 'RESTART' | 'SYNC') {
    setLoading(cmd);
    isPollingRef.current = true;
    setFeedback({
      type: 'info',
      message: `Transmitting signal '${cmd}' to host engine queue... Waiting for daemon response.`,
    });

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

      if (data.vps) {
        setCmdInfo({
          lastCommand: data.vps.lastCommand || cmd,
          commandStatus: data.vps.commandStatus || 'PENDING',
          commandMessage: data.vps.commandMessage || data.message,
          commandAt: new Date().toISOString(),
        });
      }

      // Actively poll /api/admin/bot-status until host daemon acknowledges (up to 16 attempts x 1000ms = 16s)
      const maxAttempts = 16;
      let attempt = 0;
      let confirmed = false;

      while (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempt++;

        try {
          const statusRes = await fetch('/api/admin/bot-status', { cache: 'no-store' });
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          const vps = statusData?.vps;

          if (vps) {
            setCmdInfo({
              lastCommand: vps.lastCommand || cmd,
              commandStatus: vps.commandStatus || 'PENDING',
              commandMessage: vps.commandMessage,
              commandAt: vps.commandAt || new Date().toISOString(),
            });

            if (vps.commandStatus === 'EXECUTED') {
              confirmed = true;
              setFeedback({
                type: 'success',
                message: `Signal '${cmd}' executed successfully! ${vps.commandMessage || 'All terminals synchronized.'}`,
              });
              break;
            } else if (vps.commandStatus === 'FAILED') {
              confirmed = true;
              setFeedback({
                type: 'error',
                message: `Signal '${cmd}' failed on host daemon: ${vps.commandMessage || 'Execution error.'}`,
              });
              break;
            } else if (vps.commandStatus === 'EXECUTING') {
              setFeedback({
                type: 'info',
                message: `Host engine is executing '${cmd}'... (${vps.commandMessage || 'Please wait'})`,
              });
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }

      if (!confirmed) {
        // Timed out: Host daemon was not running or did not process queue
        setFeedback({
          type: 'error',
          message: `Host Engine Unresponsive: Signal '${cmd}' was queued in database, but host engine daemon did not acknowledge it within 15 seconds. Please ensure start_bot.bat is running on your host machine.`,
        });
      }

      router.refresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error executing command',
      });
    } finally {
      isPollingRef.current = false;
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
            {loading === 'START' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            {loading === 'START' ? 'Starting Bot Engine...' : 'Start Bot Engine'}
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
            {loading === 'RESTART' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
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
            {loading === 'SYNC' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {loading === 'SYNC' ? 'Syncing Terminals...' : 'Force Sync Terminals'}
          </button>
        </div>
      </div>

      {/* Live Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl text-xs font-medium border transition-all animate-in fade-in slide-in-from-top-1 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 shadow-sm shadow-emerald-500/5'
              : feedback.type === 'info'
              ? 'bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/5'
              : 'bg-destructive/10 text-destructive border-destructive/25 shadow-sm shadow-destructive/5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : feedback.type === 'info' ? (
              <Loader2 className="w-4 h-4 shrink-0 text-primary animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
            )}
            <span className="leading-snug">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] opacity-70 hover:opacity-100 transition-opacity uppercase font-bold tracking-wider px-1.5 py-0.5 shrink-0"
          >
            Dismiss
          </button>
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
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                cmdInfo.commandStatus === 'EXECUTED'
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : cmdInfo.commandStatus === 'EXECUTING'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                  : cmdInfo.commandStatus === 'FAILED'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
              }`}
            >
              {cmdInfo.commandStatus === 'EXECUTED' && <CheckCircle2 className="w-3 h-3" />}
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
