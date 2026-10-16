'use client';

import { useState, useEffect } from 'react';
import { Server, Cpu, HardDrive, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AdminBotControls } from '@/components/admin-bot-controls';

export function InfrastructureFleetClient({ initialVpsEnvs }: { initialVpsEnvs: any[] }) {
  const [vpsEnvs, setVpsEnvs] = useState<any[]>(initialVpsEnvs);
  const [secondsMap, setSecondsMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const v of initialVpsEnvs) {
      map[v.id] = v.lastHeartbeatAt
        ? Math.max(0, Math.round((Date.now() - new Date(v.lastHeartbeatAt).getTime()) / 1000))
        : 999999;
    }
    return map;
  });

  // Ticking pulse timer (every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsMap((prev) => {
        const next: Record<string, number> = {};
        for (const [id, sec] of Object.entries(prev)) {
          next[id] = sec + 1;
        }
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
          setVpsEnvs((prev) => {
            const index = prev.findIndex((v) => v.name === data.vps.name || v.id === data.vps.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                ...data.vps,
              };
              return updated;
            } else {
              return [...prev, data.vps];
            }
          });

          setSecondsMap((prev) => ({
            ...prev,
            [data.vps.id]: data.vps.secondsAgo ?? 0,
          }));
        }
      } catch (err) {
        // Silently ignore background poll errors
      }
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Infrastructure Fleet</h1>
          <p className="text-muted-foreground">Monitor real-time hardware telemetry and command all active MT5 VPS nodes.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono bg-black/5 dark:bg-white/5 border border-border/40 px-3 py-1.5 rounded-full">
            {vpsEnvs.length} {vpsEnvs.length === 1 ? 'Node Online' : 'Nodes Registered'}
          </span>
        </div>
      </div>

      {/* Fleet Node Cards (Full Width) */}
      <div className="flex flex-col gap-6 w-full">
        {vpsEnvs.length === 0 ? (
          <div className="plaiz-card p-12 flex flex-col items-center justify-center text-center">
            <Server className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-bold">No Telemetry Received</h3>
            <p className="text-muted-foreground text-sm mt-1">Ensure the VPS manager is running and pushing telemetry to the database.</p>
          </div>
        ) : (
          vpsEnvs.map((vps: any) => {
            const diffSec = secondsMap[vps.id] ?? 999999;
            const isOnline = diffSec < 90;

            return (
              <div key={vps.id} className="plaiz-card p-6 flex flex-col gap-6 w-full">
                {/* Node Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-lg leading-tight text-foreground">{vps.name}</h3>
                        <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-border/30">
                          ID: {vps.id?.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        Primary Host PC &bull; Portable Multi-Terminal Engine
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span className="text-xs font-mono text-muted-foreground">
                      {isOnline
                        ? `Pulse received ${diffSec < 60 ? `${diffSec}s ago` : `${Math.round(diffSec / 60)}m ago`}`
                        : 'No heartbeat response'}
                    </span>
                    <div className={isOnline ? "plaiz-pill plaiz-pill-success" : "plaiz-pill plaiz-pill-destructive"}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'} mr-1`}></span>
                      {isOnline ? 'Active & Running' : 'Offline'}
                    </div>
                  </div>
                </div>

                {/* 4-Column Hardware Telemetry Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Node State */}
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/30">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node State</span>
                    <span className="text-lg font-bold text-foreground capitalize">
                      {isOnline ? (vps.status || 'HEALTHY') : 'DISCONNECTED'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Local VPS Daemon</span>
                  </div>

                  {/* CPU Load */}
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/30">
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

                  {/* RAM Load */}
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/30">
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

                  {/* Active Terminals */}
                  <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/30">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Terminals</span>
                    <span className="text-lg font-bold text-foreground num-tabular">{vps.activeTerminals ?? 0} / 25</span>
                    <span className="text-[11px] text-muted-foreground">Portable MT5 instances</span>
                  </div>
                </div>

                {/* Host Engine Command Center (Spans Full Width Cleanly) */}
                <div className="pt-2 border-t border-border/40">
                  <AdminBotControls
                    initialIsOnline={isOnline}
                    vpsName={vps.name}
                    lastCommand={vps.lastCommand}
                    commandStatus={vps.commandStatus}
                    commandMessage={vps.commandMessage}
                    commandAt={vps.commandAt ? new Date(vps.commandAt).toISOString() : null}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resource Optimization & Performance Architecture */}
      <div className="plaiz-card p-6 flex flex-col gap-4 bg-black/5 dark:bg-white/[0.02] w-full">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base">Resource-Efficient MT5 Terminal Architecture</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The Trade Copier engine incorporates multi-layer resource optimizations designed to run extensive MT5 terminal fleets on low-spec hardware without performance degradation:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-4 rounded-xl border border-border/40 bg-card/40 flex flex-col gap-1.5">
            <span className="font-bold text-foreground">Chart Memory Throttling</span>
            <span className="text-muted-foreground leading-relaxed">
              Each portable instance restricts history buffer to <code>MaxBars=1000</code>, dropping terminal RAM footprint from ~350MB down to ~75MB.
            </span>
          </div>
          <div className="p-4 rounded-xl border border-border/40 bg-card/40 flex flex-col gap-1.5">
            <span className="font-bold text-foreground">Precompiled Binary Caching</span>
            <span className="text-muted-foreground leading-relaxed">
              MetaEditor compilation is executed only when EA source changes. Existing <code>.ex5</code> binaries are reused instantly with zero CPU overhead.
            </span>
          </div>
          <div className="p-4 rounded-xl border border-border/40 bg-card/40 flex flex-col gap-1.5">
            <span className="font-bold text-foreground">Minimized Background Rendering</span>
            <span className="text-muted-foreground leading-relaxed">
              Terminals launch in minimized mode with audio effects and news feeds disabled, preventing graphical rendering cycles and saving host CPU.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
