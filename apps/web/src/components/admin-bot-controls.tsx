'use client';

import { useState } from 'react';
import { Play, RotateCcw, RefreshCw, Server, AlertCircle, CheckCircle2, Clock, Terminal } from 'lucide-react';
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
      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleCommand('START')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${loading === 'START' ? 'animate-spin' : ''}`} />
          {loading === 'START' ? 'Starting Bot...' : 'Start Bot Engine'}
        </button>

        <button
          onClick={() => handleCommand('RESTART')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading === 'RESTART' ? 'animate-spin' : ''}`} />
          {loading === 'RESTART' ? 'Restarting...' : 'Restart Fleet'}
        </button>

        <button
          onClick={() => handleCommand('SYNC')}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-secondary/80 hover:bg-secondary text-foreground border border-border/50 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading === 'SYNC' ? 'animate-spin' : ''}`} />
          {loading === 'SYNC' ? 'Syncing...' : 'Force Sync Terminals'}
        </button>
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

      {/* Daemon Command Pipeline Status */}
      {cmdInfo.lastCommand && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>
              Last Signal: <strong className="text-foreground">{cmdInfo.lastCommand}</strong>
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
            <span className="truncate max-w-md italic opacity-90 text-[11px]">
              "{cmdInfo.commandMessage}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
