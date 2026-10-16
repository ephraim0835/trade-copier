'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Users, ArrowRightLeft, ShieldAlert, Cpu, HardDrive, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AdminBotControls } from '@/components/admin-bot-controls';

interface AdminLiveOverviewProps {
  initialIsOnline: boolean;
  initialVps: any;
  totalUsers: number;
  activeMasters: number;
  activeSubs: number;
}

export function AdminLiveOverview({
  initialIsOnline,
  initialVps,
  totalUsers,
  activeMasters,
  activeSubs,
}: AdminLiveOverviewProps) {
  const [isOnline, setIsOnline] = useState(initialIsOnline);
  const [vps, setVps] = useState(initialVps);
  const [diffSeconds, setDiffSeconds] = useState(
    initialVps?.lastHeartbeatAt
      ? Math.max(0, Math.round((Date.now() - new Date(initialVps.lastHeartbeatAt).getTime()) / 1000))
      : 999999
  );

  // Smooth live counter increment for heartbeat age
  useEffect(() => {
    const timer = setInterval(() => {
      setDiffSeconds((prev) => {
        const next = prev + 1;
        setIsOnline(next < 90);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Live polling for VPS telemetry every 8 seconds
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/bot-status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.vps) {
          setVps(data.vps);
          setIsOnline(data.isOnline);
          setDiffSeconds(data.vps.secondsAgo ?? 0);
        }
      } catch (err) {
        // Silently ignore background network errors
      }
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bot Status Card */}
        <Link
          href="/admin/infrastructure"
          className="plaiz-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`}
              ></span>
              {isOnline ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
              Trade Copier Bot
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${isOnline ? 'text-emerald-500' : 'text-destructive'}`}>
                {isOnline ? 'Running' : 'Offline'}
              </span>
              {isOnline && vps && (
                <span className="text-xs text-muted-foreground font-mono">
                  ({vps.name})
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block mt-2">
              {isOnline
                ? `Pulse received ${diffSeconds < 60 ? `${diffSeconds}s ago` : `${Math.round(diffSeconds / 60)}m ago`}`
                : 'VPS manager daemon not detected'}
            </span>
          </div>
        </Link>

        {/* Total Users */}
        <Link href="/admin/users" className="plaiz-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
          <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-4 group-hover:bg-accent/80 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">Total Users</span>
            <span className="text-2xl font-bold num-tabular">{totalUsers}</span>
            <span className="text-[11px] text-muted-foreground block mt-2">Registered accounts</span>
          </div>
        </Link>

        {/* Active Masters */}
        <Link href="/admin/copier" className="plaiz-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">Active Masters</span>
            <span className="text-2xl font-bold num-tabular">{activeMasters}</span>
            <span className="text-[11px] text-muted-foreground block mt-2">Signal providers online</span>
          </div>
        </Link>

        {/* Active Subs */}
        <Link href="/admin/copier" className="plaiz-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">Active Subs</span>
            <span className="text-2xl font-bold num-tabular">{activeSubs}</span>
            <span className="text-[11px] text-muted-foreground block mt-2">Slave accounts receiving trades</span>
          </div>
        </Link>
      </div>

      {/* Live Bot Daemon & Hardware Telemetry Panel */}
      <section className="plaiz-card p-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
              }`}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Trade Copier Engine Telemetry</h2>
              <p className="text-xs text-muted-foreground">Live heartbeat status reported by the MT5 VPS Manager daemon.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <span className="plaiz-pill plaiz-pill-success">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Bot Active & Synchronized
              </span>
            ) : (
              <span className="plaiz-pill plaiz-pill-destructive">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Bot Daemon Stopped
              </span>
            )}
            <Link href="/admin/infrastructure" className="plaiz-btn plaiz-btn-secondary py-1.5 px-3 text-xs">
              Fleet Details
            </Link>
          </div>
        </div>

        {isOnline && vps ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node Instance</span>
              <span className="text-lg font-bold text-foreground">{vps.name}</span>
              <span className="text-[11px] text-muted-foreground font-mono">ID: {vps.id?.slice(0, 8)}...</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-primary" /> CPU Load
                </span>
                <span className="text-sm font-bold num-tabular">{vps.cpuPercent}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, vps.cpuPercent || 0)}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-muted-foreground">Max threshold: 85%</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-accent-foreground" /> RAM Load
                </span>
                <span className="text-sm font-bold num-tabular">{vps.ramPercent}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, vps.ramPercent || 0)}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-muted-foreground">Allocated physical RAM</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Terminals</span>
              <span className="text-lg font-bold text-foreground num-tabular">{vps.activeTerminals ?? 0} / 25</span>
              <span className="text-[11px] text-muted-foreground">Portable MT5 instances</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <span className="font-bold text-foreground block text-sm">VPS MT5 Manager daemon is not running</span>
                <span className="text-muted-foreground">
                  Click <strong>Start Bot Engine</strong> below or run <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">start_bot.bat</code> on your host machine to wake the fleet.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Remote Bot Controls */}
        <div className="pt-2 border-t border-border/40">
          <AdminBotControls
            initialIsOnline={isOnline}
            vpsName={vps?.name}
            lastCommand={vps?.lastCommand}
            commandStatus={vps?.commandStatus}
            commandMessage={vps?.commandMessage}
            commandAt={vps?.commandAt ? new Date(vps.commandAt).toISOString() : null}
          />
        </div>
      </section>
    </div>
  );
}
