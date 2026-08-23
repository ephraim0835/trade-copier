import { Activity, ShieldCheck, ArrowUpRight, Wifi, ShieldAlert, ArrowRightLeft, Users, Clock, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ThemeToggle } from '@/components/theme-toggle';

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
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight text-foreground flex items-center gap-2">
            Good morning, Admin! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            Here's what's happening with your copier today.
          </p>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="bg-card border border-border/60 rounded-full pl-9 pr-12 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-[240px] text-foreground placeholder:text-muted-foreground/70"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border/50">⌘K</span>
            </div>
          </div>
          
          <button className="relative w-10 h-10 rounded-full bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></span>
          </button>
          
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          <div className="hidden md:flex items-center gap-3 pl-2 border-l border-border/50">
            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border/40">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Admin&backgroundColor=transparent`} alt="Admin" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-foreground leading-none">Admin</span>
              <span className="text-[11px] text-muted-foreground mt-1">Administrator</span>
            </div>
            <svg className="w-4 h-4 text-muted-foreground ml-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* PREMIUM BENTO COMPOSITION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-min">
        
        {/* =========================================
            ROW 1: HERO & SYSTEM HEALTH
            ========================================= */}
            
        {/* HERO FOCAL POINT (P/L + Chart Integrated) */}
        <section className="lg:col-span-2 flex flex-col h-full">
          <div className="hero-panel flex-1 rounded-[24px] p-6 lg:p-8 flex flex-col justify-between min-h-[280px]">
            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <span className="text-primary font-bold text-lg leading-none">$</span>
                  </div>
                  <h2 className="text-[15px] font-semibold text-foreground tracking-wide uppercase opacity-90">Today's Profit</h2>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[12px] font-medium flex items-center gap-1.5 backdrop-blur-md">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                  4.82% vs yesterday
                </div>
              </div>
              
              <div className="mt-8 mb-4">
                <div className={`text-[48px] lg:text-[64px] font-bold tracking-tighter leading-none ${isProfit ? 'text-foreground' : 'text-destructive'}`}>
                  {isProfit ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaysTotalPl)}
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Copied Trades</span>
                    <span className="text-[16px] font-semibold text-foreground">{copiedTradesToday}</span>
                  </div>
                  <div className="w-[1px] h-8 bg-border/60"></div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Active Subs</span>
                    <span className="text-[16px] font-semibold text-primary">{activeSubs} / {subAccounts.length}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background Integrated Chart */}
            <div className="absolute bottom-0 left-0 right-0 h-[60%] z-0 pointer-events-none opacity-60 mix-blend-screen" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)' }}>
              <PerformanceChart data={chartData} />
            </div>
          </div>
        </section>

        {/* SYSTEM STATUS (Stacked Solid) */}
        <section className="lg:col-span-1 flex flex-col h-full gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">System Health</h2>
          </div>
          
          <div className={`bg-card rounded-[20px] border p-5 shadow-sm flex items-center justify-between transition-colors ${allConnected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${allConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`}></div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Engine Status</p>
                <p className="text-[12px] text-muted-foreground">{allConnected ? 'Routing Active' : 'Connection Degraded'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex items-center justify-between flex-1">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border/60">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Master API</p>
                <p className="text-[12px] text-muted-foreground">{masterOnline ? '42ms Latency' : 'Disconnected'}</p>
              </div>
            </div>
            {masterOnline && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded">LIVE</span>
            )}
          </div>
        </section>


        {/* =========================================
            ROW 2: ACCOUNTS
            ========================================= */}
            
        {/* MASTER ACCOUNT DIGITAL CARD */}
        <section className="lg:col-span-1 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Master Source</h2>
          </div>
          
          <div className="digital-card rounded-[24px] p-6 flex-1 flex flex-col justify-between">
            {masterAccount ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 rounded-[14px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                      <svg className="w-6 h-6 text-foreground opacity-80" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8v8"/><path d="m8 12 4-4 4 4"/></svg>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-black/40 dark:bg-black/40 border border-white/10 text-[10px] font-medium tracking-wide">
                      {masterAccount.broker}
                    </div>
                  </div>
                  
                  <h3 className="text-[18px] font-bold text-foreground tracking-tight">{masterAccount.login}</h3>
                  <p className="text-[12px] text-muted-foreground mt-1">Live Execution Account</p>
                </div>
                
                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-end border-b border-border/40 pb-3">
                    <span className="text-[12px] text-muted-foreground">Equity</span>
                    <span className="text-[16px] font-bold text-foreground">
                      {masterAccount.equity != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.equity) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[12px] text-muted-foreground">Floating P/L</span>
                    <span className={`text-[16px] font-bold ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                      {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.floatingPl || 0)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <ShieldAlert className="w-10 h-10 mb-4" />
                <p className="text-sm font-medium">No Master Connected</p>
              </div>
            )}
          </div>
        </section>

        {/* SUB ACCOUNTS (Layered Depth Layout) */}
        <section className="lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Sub Accounts</h2>
            <button className="text-[11px] text-foreground hover:text-primary uppercase tracking-wider font-bold transition-colors">Manage All</button>
          </div>
          
          <div className="bg-card rounded-[24px] border border-border/40 p-6 shadow-sm flex-1">
            {subAccounts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subAccounts.map((sub) => (
                  <div key={sub.id} className="mini-card rounded-[16px] p-5 flex flex-col justify-between group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center border border-border/50 text-primary transition-colors group-hover:bg-primary/10">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-foreground leading-tight">{sub.login}</p>
                          <p className="text-[11px] text-muted-foreground">{sub.broker}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground'}`}></div>
                    </div>
                    
                    <div className="flex justify-between items-end bg-background/50 rounded-[12px] p-3 border border-border/30">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Balance</p>
                        <p className="text-[14px] font-semibold text-foreground">
                          {sub.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.balance) : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Risk Mult</p>
                        <p className="text-[14px] font-semibold text-foreground">
                          {sub.copySettings?.riskMultiplier ? (sub.copySettings.riskMultiplier * 100).toFixed(0) : 100}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-10">
                <Users className="w-10 h-10 mb-4" />
                <p className="text-sm font-medium">No Sub Accounts</p>
              </div>
            )}
          </div>
        </section>


        {/* =========================================
            ROW 3: INSIGHTS & RISK
            ========================================= */}
            
        {/* RISK VISUALIZATION (Radial Gauge) */}
        <section className="lg:col-span-1 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Risk Utilization</h2>
          </div>
          
          <div className="bg-card rounded-[24px] border border-border/40 p-6 shadow-sm flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Custom CSS Radial Ring */}
            <div className="relative w-40 h-40 flex items-center justify-center my-4">
              {/* Background Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" className="stroke-secondary fill-none" strokeWidth="8" />
                {/* Foreground Ring */}
                <circle cx="80" cy="80" r="70" className="stroke-accent fill-none drop-shadow-[0_0_8px_rgba(63,236,255,0.6)]" strokeWidth="8" strokeDasharray="439.8" strokeDashoffset={439.8 - (439.8 * 0.12)} strokeLinecap="round" />
              </svg>
              {/* Center Content */}
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-[32px] font-bold text-foreground leading-none">12%</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Used</span>
              </div>
            </div>
            
            <div className="w-full flex justify-between items-center px-4 mt-2">
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Exposure</span>
                <span className="text-[14px] font-semibold text-foreground">$120.00</span>
              </div>
              <div className="w-[1px] h-6 bg-border/60"></div>
              <div className="flex flex-col text-right">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Limit</span>
                <span className="text-[14px] font-semibold text-foreground">$1,000.00</span>
              </div>
            </div>
          </div>
        </section>

        {/* ACTIVITY TIMELINE */}
        <section className="lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
            <button className="text-[11px] text-foreground hover:text-primary uppercase tracking-wider font-bold transition-colors">History</button>
          </div>
          
          <div className="bg-card rounded-[24px] border border-border/40 p-6 shadow-sm flex-1">
            {recentActivity.length > 0 ? (
              <div className="space-y-0">
                {recentActivity.map((activity, idx) => {
                  const isExecuted = activity.state === 'EXECUTED';
                  const isFailed = activity.state === 'FAILED' || activity.state === 'REJECTED';
                  return (
                    <div key={activity.id} className="group relative flex gap-6 pb-6 last:pb-0">
                      {/* Vertical line connecting dots */}
                      {idx !== recentActivity.length - 1 && (
                        <div className="absolute left-[19px] top-8 bottom-[-8px] w-[2px] bg-border/40 group-hover:bg-border transition-colors"></div>
                      )}
                      
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-card ${isExecuted ? 'bg-emerald-500/20 text-emerald-500' : isFailed ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                        {isExecuted ? <ArrowRightLeft className="w-4 h-4" /> : isFailed ? <ShieldAlert className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1">
                        <div>
                          <p className="text-[14px] font-semibold text-foreground">
                            {isExecuted ? 'Market Execution' : isFailed ? 'Execution Failed' : 'Signal Processing'}
                          </p>
                          <p className="text-[12px] text-muted-foreground mt-0.5">
                            {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.volume} {activity.signal?.symbol} • {activity.subAccount?.login}
                          </p>
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border border-border/50 self-start md:self-auto">
                          {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-10">
                <Activity className="w-10 h-10 mb-4" />
                <p className="text-sm font-medium">No Activity</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
