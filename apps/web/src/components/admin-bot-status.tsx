'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu, HardDrive } from 'lucide-react';

interface BotStatusData {
  isOnline: boolean;
  vps: {
    id: string;
    name: string;
    status: string;
    cpuPercent: number;
    ramPercent: number;
    diskPercent: number;
    activeTerminals: number;
    lastHeartbeatAt: string;
    secondsAgo: number;
  } | null;
}

export function AdminBotStatus({ initialData }: { initialData?: BotStatusData }) {
  const [data, setData] = useState<BotStatusData | null>(initialData || null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const res = await fetch('/api/admin/bot-status', { cache: 'no-store' });
        if (res.ok && active) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.warn('Failed to poll bot status:', err);
      }
    }

    // Poll every 12 seconds
    const interval = setInterval(checkStatus, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const isOnline = data?.isOnline ?? false;
  const vps = data?.vps;

  return (
    <div className="relative">
      <Link
        href="/admin/infrastructure"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
          isOnline
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 shadow-sm'
            : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
        </span>
        <span className="tracking-wide">
          {isOnline ? 'Bot Active' : 'Bot Offline'}
        </span>
        {isOnline && vps && (
          <span className="text-[10px] opacity-75 hidden sm:inline font-mono">
            ({vps.name})
          </span>
        )}
      </Link>

      {/* Hover popover with live telemetry */}
      {hovered && vps && (
        <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl z-50 text-xs flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
            <span className="font-bold text-foreground">{vps.name}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
              {isOnline ? 'RUNNING' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Load</span>
            <span className="font-semibold text-foreground num-tabular">{vps.cpuPercent}%</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> RAM Load</span>
            <span className="font-semibold text-foreground num-tabular">{vps.ramPercent}%</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>MT5 Terminals</span>
            <span className="font-semibold text-foreground num-tabular">{vps.activeTerminals} active</span>
          </div>
          <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground text-right">
            Last seen: {vps.secondsAgo < 60 ? `${vps.secondsAgo}s ago` : `${Math.round(vps.secondsAgo / 60)}m ago`}
          </div>
        </div>
      )}
    </div>
  );
}
