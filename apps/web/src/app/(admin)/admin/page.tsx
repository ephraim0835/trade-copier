import { Server, Users, ArrowRightLeft, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AdminLiveOverview } from '@/components/admin-live-overview';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  let totalUsers = 0;
  let activeSubs = 0;
  let activeMasters = 0;
  let latestVps: any = null;
  let systemEvents: any[] = [];
  
  try {
    totalUsers = await prisma.user.count();
    activeSubs = await prisma.mt5Account.count({ where: { role: 'SUB', isActive: true } });
    activeMasters = await prisma.mt5Account.count({ where: { role: 'MASTER', isActive: true } });
    latestVps = await prisma.vpsEnvironment.findFirst({
      orderBy: { lastHeartbeatAt: 'desc' },
    });

    // 1. Audit log risk rejections
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { rejectionReason: { not: null } },
          { decision: { in: ['REJECTED', 'FAILED'] } }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { subAccount: true }
    });

    // 2. MT5 Account provisioning / broker authorization errors
    const accountErrors = await prisma.mt5Account.findMany({
      where: { provisioningError: { not: null } },
      take: 5,
      orderBy: { updatedAt: 'desc' }
    });

    // Combine and sort
    systemEvents = [
      ...auditLogs.map((a: any) => ({
        id: a.id,
        type: 'RISK_INTERVENTION',
        severity: 'warning',
        title: 'Risk Policy Intervention',
        message: a.rejectionReason || `Trade rejected due to risk bounds (intended: ${a.intendedRisk}%, max: ${a.maxPermittedRisk}%)`,
        account: a.subAccount?.login,
        createdAt: a.createdAt,
      })),
      ...accountErrors.map((acc: any) => ({
        id: acc.id,
        type: 'PROVISIONING_ERROR',
        severity: 'error',
        title: 'Broker Authorization Issue',
        message: acc.provisioningError,
        account: acc.login,
        createdAt: acc.updatedAt,
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

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

      {/* Live Overview Cards and Bot Telemetry */}
      <AdminLiveOverview
        initialIsOnline={isBotActive}
        initialVps={latestVps ? {
          id: latestVps.id,
          name: latestVps.name,
          status: latestVps.status,
          cpuPercent: latestVps.cpuPercent,
          ramPercent: latestVps.ramPercent,
          diskPercent: latestVps.diskPercent,
          activeTerminals: latestVps.activeTerminals,
          lastHeartbeatAt: latestVps.lastHeartbeatAt ? new Date(latestVps.lastHeartbeatAt).toISOString() : null,
          secondsAgo: diffSeconds,
          lastCommand: latestVps.lastCommand,
          commandStatus: latestVps.commandStatus,
          commandMessage: latestVps.commandMessage,
          commandAt: latestVps.commandAt ? new Date(latestVps.commandAt).toISOString() : null,
        } : null}
        totalUsers={totalUsers}
        activeMasters={activeMasters}
        activeSubs={activeSubs}
      />

      {/* System Events & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="plaiz-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Recent System Events</h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Live Risk Stream</span>
            </div>

            {systemEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-1">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-foreground">All Systems Nominal</span>
                <span className="text-xs max-w-sm text-muted-foreground">
                  No risk interventions, broker authorization rejections, or trade routing errors recorded.
                </span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/20">
                {systemEvents.map((ev) => (
                  <div key={ev.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                    <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${ev.severity === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'}`}>
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{ev.title}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{ev.message}</span>
                      {ev.account && (
                        <span className="text-[10px] font-mono text-primary mt-0.5">Account: {ev.account}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="plaiz-card p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-4">Quick Navigation</h3>
          <div className="flex flex-col gap-3">
            <Link href="/admin/infrastructure" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3 hover:border-primary/40 transition-all">
              <Server className="w-4 h-4 mr-2 text-primary" /> Check VPS Hardware & Terminals
            </Link>
            <Link href="/admin/copier" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3 hover:border-primary/40 transition-all">
              <ArrowRightLeft className="w-4 h-4 mr-2 text-emerald-500" /> Monitor Live Copier Routing & Latency
            </Link>
            <Link href="/admin/users" className="plaiz-btn plaiz-btn-secondary w-full justify-start text-xs py-3 hover:border-primary/40 transition-all">
              <Users className="w-4 h-4 mr-2 text-purple-500" /> Manage Users & Entitlements
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
