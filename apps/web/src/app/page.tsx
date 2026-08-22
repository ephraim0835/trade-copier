import { Activity, ShieldCheck, ArrowUpRight, Wifi, ShieldAlert, ArrowRightLeft, Users, Clock, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PerformanceChart } from '@/components/dashboard/performance-chart';

export default async function DashboardOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch Data
  const accounts = await prisma.mt5Account.findMany({
    include: {
      copySettings: true,
      eaTokens: true,
    },
    orderBy: { createdAt: 'asc' }
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

  // Financials
  const todayDeals = await prisma.deal.findMany({
    where: { time: { gte: startOfDay } }
  });
  
  const closedProfit = todayDeals.reduce((sum, deal) => sum + deal.profit + deal.commission + deal.swap, 0);
  const floatingPl = accounts.reduce((sum, a) => sum + (a.floatingPl || 0), 0);
  const todaysTotalPl = closedProfit + floatingPl;
  
  const isProfit = todaysTotalPl >= 0;

  // Copied Trades
  const copiedTradesToday = await prisma.tradeCopy.count({
    where: { createdAt: { gte: startOfDay }, state: 'EXECUTED' }
  });

  // Recent Activity
  const recentActivity = await prisma.tradeCopy.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      signal: true,
      subAccount: true
    }
  });

  // Mocked Chart Data (In a real scenario, this would aggregate deal history over 7 days)
  const chartData = [
    { date: 'Mon', value: Math.max(0, todaysTotalPl - 150) },
    { date: 'Tue', value: Math.max(0, todaysTotalPl - 50) },
    { date: 'Wed', value: todaysTotalPl + 120 },
    { date: 'Thu', value: todaysTotalPl - 30 },
    { date: 'Fri', value: todaysTotalPl + 200 },
    { date: 'Sat', value: todaysTotalPl },
    { date: 'Sun', value: todaysTotalPl },
  ];

  return (
    <div className="flex-1 p-5 lg:p-8 space-y-8 overflow-y-auto custom-scrollbar pb-24 lg:pb-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Good morning, Admin! 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            Here's what's happening with your copier today.
          </p>
        </div>
        
        {/* System Status Pill */}
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full border shadow-sm ${allConnected ? 'bg-[#1a1a1a] border-[#272733]' : 'bg-destructive/10 border-destructive/20'}`}>
          <div className="relative flex h-3 w-3">
            {allConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${allConnected ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
          </div>
          <span className={`text-sm font-medium ${allConnected ? 'text-foreground' : 'text-destructive'}`}>
            {allConnected ? 'All Systems Operational' : 'Connection Degraded'}
          </span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <MetricCard 
          title="Today's P/L" 
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaysTotalPl)} 
          isPositive={isProfit}
        />
        <MetricCard 
          title="Copied Trades" 
          value={copiedTradesToday.toString()} 
          subtitle="Executions today"
        />
        <MetricCard 
          title="Active Sub Accounts" 
          value={`${activeSubs} / ${subAccounts.length}`}
          subtitle="Receiving signals"
        />
        <MetricCard 
          title="Daily Risk Used" 
          value="1.32%" // Placeholder until full risk aggregation is built
          subtitle="of 3.00% max limit"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* MASTER ACCOUNT */}
          <section>
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Master Account
            </h2>
            {masterAccount ? (
              <div className="bg-card rounded-2xl border border-border p-5 lg:p-6 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{masterAccount.login}</h3>
                    <p className="text-sm text-muted-foreground">{masterAccount.broker} • {masterAccount.isDemo ? 'Demo' : 'Live'}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${masterOnline ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    {masterOnline ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Equity</p>
                    <p className="text-lg font-semibold text-foreground">
                      {masterAccount.equity != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.equity) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Balance</p>
                    <p className="text-lg font-semibold text-foreground">
                      {masterAccount.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.balance) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Floating P/L</p>
                    <p className={`text-lg font-semibold ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.floatingPl || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Signal Delay</p>
                    <p className="text-lg font-semibold text-emerald-500">42ms</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-8 shadow-sm flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Connect your Master account</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Your Master account sends trades to your connected Sub Accounts. Connect it to start copying.
                </p>
                <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                  Add Master Account
                </button>
              </div>
            )}
          </section>

          {/* PERFORMANCE CHART */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Performance</h2>
              <select className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option>7 Days</option>
                <option>30 Days</option>
                <option>90 Days</option>
              </select>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 lg:p-6 shadow-sm">
              <PerformanceChart data={chartData} />
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          
          {/* SUB ACCOUNTS */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Sub Accounts
              </h2>
              <button className="text-sm text-primary hover:underline font-medium">View All</button>
            </div>
            
            {subAccounts.length > 0 ? (
              <div className="space-y-3">
                {subAccounts.map((sub, idx) => (
                  <div key={sub.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3 transition-colors hover:border-primary/50 cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{sub.login}</p>
                          <p className="text-xs text-muted-foreground">MT5 • {sub.isDemo ? 'Demo' : 'Live'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {sub.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.balance) : 'N/A'}
                        </p>
                        <p className={`text-xs ${(sub.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                          {(sub.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.floatingPl || 0)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                        <span className="text-xs text-muted-foreground">{sub.isActive ? 'Copying' : 'Paused'}</span>
                      </div>
                      <div className="text-xs font-medium text-foreground bg-secondary px-2 py-1 rounded-md">
                        Risk: {sub.copySettings?.riskMultiplier || 1.0}x
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col items-center justify-center text-center">
                <Users className="w-8 h-8 text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">No Sub Accounts yet</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Connect an account to start copying trades.
                </p>
                <button className="bg-secondary text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
                  Add Account
                </button>
              </div>
            )}
          </section>

          {/* RECENT ACTIVITY */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Activity
              </h2>
              <button className="text-sm text-primary hover:underline font-medium">View All</button>
            </div>
            
            <div className="bg-card rounded-xl border border-border p-2 shadow-sm">
              {recentActivity.length > 0 ? (
                <div className="flex flex-col">
                  {recentActivity.map((activity, idx) => {
                    const isExecuted = activity.state === 'EXECUTED';
                    const isFailed = activity.state === 'FAILED' || activity.state === 'REJECTED';
                    return (
                      <div key={activity.id} className={`flex items-center gap-3 p-3 ${idx !== recentActivity.length - 1 ? 'border-b border-border/50' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isExecuted ? 'bg-emerald-500/10 text-emerald-500' : isFailed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {isExecuted ? <ArrowRightLeft className="w-4 h-4" /> : isFailed ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {isExecuted ? 'Trade Copied' : isFailed ? 'Trade Failed' : 'Processing'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.signal?.symbol} • {activity.signal?.type} • {activity.subAccount?.login}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No recent activity to show.</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ title, value, subtitle, isPositive }: { title: string, value: string, subtitle?: string, isPositive?: boolean }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 lg:p-5 shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors">
      <h3 className="text-xs lg:text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <div>
        <div className="text-xl lg:text-3xl font-bold text-foreground">{value}</div>
        {subtitle && (
          <p className={`text-[10px] lg:text-xs mt-1 ${isPositive === true ? 'text-emerald-500' : isPositive === false ? 'text-destructive' : 'text-muted-foreground'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
