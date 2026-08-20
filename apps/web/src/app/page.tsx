import { Activity, ShieldCheck, Wifi, ArrowUpRight, WifiOff, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export default async function DashboardOverview() {
  const accounts = await prisma.mt5Account.findMany({
    include: {
      copySettings: true,
      eaTokens: true,
    },
  });

  const masterAccount = accounts.find((a: any) => a.role === 'MASTER');
  const subAccounts = accounts.filter((a: any) => a.role === 'SUB');
  
  const activeSubs = subAccounts.filter((a: any) => a.isActive).length;
  
  // Heartbeat check: EA is considered online if lastUsedAt is within 5 minutes
  const isOnline = (token: any) => {
    if (!token?.lastUsedAt) return false;
    return new Date().getTime() - new Date(token.lastUsedAt).getTime() < 5 * 60 * 1000;
  };

  const masterToken = masterAccount?.eaTokens?.[0];
  const masterOnline = masterAccount?.isActive && isOnline(masterToken);
  
  const onlineSubs = subAccounts.filter((sub: any) => sub.isActive && isOnline(sub.eaTokens?.[0])).length;
  const allConnected = masterOnline && onlineSubs === subAccounts.length;

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your MT5 connections and account health in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Status Card */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">System Status</h3>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${allConnected ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
              {allConnected ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-destructive" />}
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${allConnected ? 'text-emerald-500' : 'text-destructive'}`}>
              {allConnected ? 'Online' : 'Degraded'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allConnected ? 'All EAs connected' : 'Some EAs offline'}
            </p>
          </div>
        </div>

        {/* Master Account */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Master Account</h3>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${masterOnline ? 'bg-primary/10' : 'bg-muted'}`}>
              <ShieldCheck className={`w-4 h-4 ${masterOnline ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {masterAccount?.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.balance) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {masterAccount?.login} ({masterAccount?.broker})
            </p>
            {masterAccount?.floatingPl != null && (
              <p className={`text-xs mt-1 ${masterAccount.floatingPl >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {masterAccount.floatingPl >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.floatingPl)} Floating
              </p>
            )}
          </div>
        </div>
        
        {/* Sub Accounts */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Active Sub Accounts</h3>
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-accent" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{activeSubs} / {subAccounts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Receiving signals</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm min-h-[400px]">
          <h3 className="font-semibold mb-4">Recent Executions</h3>
          <div className="flex items-center justify-center h-[300px] border border-dashed border-border rounded-lg bg-secondary/20">
            <p className="text-muted-foreground text-sm">Real-time data stream will appear here</p>
          </div>
        </div>
        
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm min-h-[400px]">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
              <div className="font-medium text-sm">Add Sub Account</div>
              <div className="text-xs text-muted-foreground mt-0.5">Connect a new MT5 terminal</div>
            </button>
            <button className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
              <div className="font-medium text-sm">Emergency Stop</div>
              <div className="text-xs text-muted-foreground mt-0.5">Halt all new trade copying</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
