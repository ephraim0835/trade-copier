import { Server, Users, ArrowRightLeft, ShieldAlert, Cpu, HardDrive, Bot, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AdminBotControls } from '@/components/admin-bot-controls';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  let totalUsers = 0;
  let activeSubs = 0;
  let activeMasters = 0;
  let latestVps: any = null;
  
  try {
    totalUsers = await prisma.user.count();
    activeSubs = await prisma.mt5Account.count({ where: { role: 'SUB', isActive: true } });
    activeMasters = await prisma.mt5Account.count({ where: { role: 'MASTER', isActive: true } });
    latestVps = await prisma.vpsEnvironment.findFirst({
      orderBy: { lastHeartbeatAt: 'desc' },
    });
  } catch (e) {
    console.error("Database connection failed in admin overview:", e);
  }

  const diffSeconds = latestVps && latestVps.lastHeartbeatAt
    ? Math.round((Date.now() - new Date(latestVps.lastHeartbeatAt).getTime()) / 1000)
    : 999999;
  const isBotActive = diffSeconds < 90;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Platform Overview</h1>
        <p className="text-muted-foreground">High-level telemetry, trade copier bot daemon status, and system operations.</p>
      </div>
      
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bot Status Card */}
        <Link
          href="/admin/infrastructure"
          className="plaiz-card p-6 flex flex-col justify-between hover:border-primary/50 transition-all group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isBotActive ? 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20' : 'bg-destructive/10 text-destructive'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 ${
              isBotActive
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isBotActive ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`}></span>
              {isBotActive ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">Trade Copier Bot</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${isBotActive ? 'text-emerald-500' : 'text-destructive'}`}>
                {isBotActive ? 'Running' : 'Offline'}
              </span>
              {isBotActive && latestVps && (
                <span className="text-xs text-muted-foreground font-mono">
                  ({latestVps.name})
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground block mt-2">
              {isBotActive
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
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isBotActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Trade Copier Engine Telemetry</h2>
              <p className="text-xs text-muted-foreground">Live heartbeat status reported by the MT5 VPS Manager daemon.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isBotActive ? (
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

        {isBotActive && latestVps ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node Instance</span>
              <span className="text-lg font-bold text-foreground">{latestVps.name}</span>
              <span className="text-[11px] text-muted-foreground font-mono">ID: {latestVps.id.slice(0, 8)}...</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-primary" /> CPU Load
                </span>
                <span className="text-sm font-bold num-tabular">{latestVps.cpuPercent}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, latestVps.cpuPercent)}%` }}></div>
              </div>
              <span className="text-[10px] text-muted-foreground">Max threshold: 85%</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-accent-foreground" /> RAM Load
                </span>
                <span className="text-sm font-bold num-tabular">{latestVps.ramPercent}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(100, latestVps.ramPercent)}%` }}></div>
              </div>
              <span className="text-[10px] text-muted-foreground">Allocated physical RAM</span>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Terminals</span>
              <span className="text-lg font-bold text-foreground num-tabular">{latestVps.activeTerminals} / 25</span>
              <span className="text-[11px] text-muted-foreground">Portable MT5 instances</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <span className="font-bold text-foreground block text-sm">VPS MT5 Manager daemon is not running</span>
                <span className="text-muted-foreground">Click <strong>Start Bot Engine</strong> below or run <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">start_bot.bat</code> on your host machine to wake the fleet.</span>
              </div>
            </div>
          </div>
        )}

        {/* Remote Bot Controls */}
        <div className="pt-2 border-t border-border/40">
          <AdminBotControls
            initialIsOnline={isBotActive}
            vpsName={latestVps?.name}
            lastCommand={latestVps?.lastCommand}
            commandStatus={latestVps?.commandStatus}
            commandMessage={latestVps?.commandMessage}
            commandAt={latestVps?.commandAt ? new Date(latestVps.commandAt).toISOString() : null}
          />
        </div>
      </section>
      
      {/* System Events & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="plaiz-card p-6 flex flex-col">
           <h3 className="text-lg font-bold mb-4">Recent System Events</h3>
           <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
             <span className="text-sm">No critical risk interventions or errors recorded.</span>
           </div>
        </section>
        
        <section className="plaiz-card p-6 flex flex-col">
           <h3 className="text-lg font-bold mb-4">Quick Navigation</h3>
           <div className="flex flex-col gap-3">
             <Link href="/admin/infrastructure" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3">
               <Server className="w-4 h-4 mr-2 text-muted-foreground" /> Check VPS Hardware & Terminals
             </Link>
             <Link href="/admin/copier" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3">
               <ArrowRightLeft className="w-4 h-4 mr-2 text-muted-foreground" /> Monitor Live Copier Routing & Latency
             </Link>
             <Link href="/admin/users" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3">
               <Users className="w-4 h-4 mr-2 text-muted-foreground" /> Manage Users & Entitlements
             </Link>
           </div>
        </section>
      </div>
    </div>
  );
}

