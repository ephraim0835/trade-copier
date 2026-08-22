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

      {/* SYSTEM STATUS ROW */}
      <div className="flex flex-col lg:flex-row gap-4 w-full">
        <div className="flex-1 bg-card border border-border/40 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#1f2937] flex items-center justify-center">
              <div className="relative flex h-3 w-3">
                {allConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${allConnected ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-foreground">Copier Active</span>
              <span className="text-[13px] text-muted-foreground">{allConnected ? 'All systems are running smoothly' : 'Connection Degraded'}</span>
            </div>
          </div>
          <svg className="w-5 h-5 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>

        <div className="flex-1 bg-card border border-border/40 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#1f2937] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-foreground">Master Connected</span>
            <span className="text-[13px] text-muted-foreground">{masterAccount ? `${masterAccount.login} • ${masterAccount.broker}` : 'No Master'}</span>
          </div>
        </div>

        <div className="flex-1 bg-card border border-border/40 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#1f2937] flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-foreground">Accounts Copying</span>
              <span className="text-[13px] text-muted-foreground">{activeSubs} of {subAccounts.length} sub accounts</span>
            </div>
          </div>
          <button className="text-[13px] font-medium text-foreground bg-secondary border border-border/50 hover:bg-secondary/80 px-4 py-1.5 rounded-full transition-colors">
            View status
          </button>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        
        {/* P/L Card */}
        <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[160px]">
          <div className="flex justify-between items-start">
            <h3 className="text-[13px] font-medium text-foreground">Today's P/L</h3>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-500 font-bold text-sm">$</span>
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-[28px] font-bold tracking-tight ${isProfit ? 'text-emerald-500' : 'text-destructive'}`}>
              {isProfit ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaysTotalPl)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <svg className="w-3.5 h-3.5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              <span className="text-[11px] font-medium text-emerald-500">4.82%</span>
              <span className="text-[11px] text-muted-foreground ml-0.5">vs yesterday</span>
            </div>
          </div>
          {/* Decorative Sparkline */}
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-50 pointer-events-none">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full stroke-emerald-500 fill-none" strokeWidth="1.5">
              <path d="M0,25 C10,20 15,30 25,15 C35,0 45,20 55,10 C65,0 75,25 85,5 C95,-15 100,20 100,20" />
            </svg>
          </div>
        </div>

        {/* Copied Trades Card */}
        <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[160px]">
          <div className="flex justify-between items-start">
            <h3 className="text-[13px] font-medium text-foreground">Copied Trades</h3>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[28px] font-bold tracking-tight text-foreground">
              {copiedTradesToday}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <svg className="w-3.5 h-3.5 text-purple-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              <span className="text-[11px] font-medium text-purple-500">14.29%</span>
            </div>
          </div>
          {/* Decorative Sparkline */}
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-50 pointer-events-none">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full stroke-purple-500 fill-none" strokeWidth="1.5">
              <path d="M0,20 C20,25 30,5 50,15 C70,25 80,10 100,5" />
            </svg>
          </div>
        </div>

        {/* Active Accounts Card */}
        <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[160px]">
          <div className="flex justify-between items-start">
            <h3 className="text-[13px] font-medium text-foreground">Active Sub Accounts</h3>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[28px] font-bold tracking-tight text-foreground">
              {activeSubs} <span className="text-xl text-muted-foreground font-medium">/ {subAccounts.length}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[11px] font-medium text-primary">100% connected</span>
            </div>
          </div>
          {/* Decorative Sparkline */}
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-50 pointer-events-none">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full stroke-primary fill-none" strokeWidth="1.5">
              <path d="M0,15 C20,15 30,25 50,20 C70,15 80,10 100,10" />
            </svg>
          </div>
        </div>

        {/* Risk Card */}
        <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm relative flex flex-col justify-between h-[160px]">
          <div className="flex justify-between items-start">
            <h3 className="text-[13px] font-medium text-foreground">Daily Risk Used</h3>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-[28px] font-bold tracking-tight text-foreground">
              12%
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[11px] text-muted-foreground">of $1,000 limit</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-secondary rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: '12%' }}></div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID - ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* MASTER ACCOUNT */}
        <section className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Master Account</h2>
            <div className={`px-2 py-0.5 rounded text-[10px] font-medium border ${masterOnline ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
              {masterOnline ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex-1 flex flex-col justify-between">
            {masterAccount ? (
              <>
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <svg className="w-5 h-5 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground">{masterAccount.login}</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{masterAccount.broker} • {masterAccount.isDemo ? 'Demo' : 'Live'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Equity</p>
                    <p className="text-[15px] font-semibold text-foreground">
                      {masterAccount.equity != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.equity) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Balance</p>
                    <p className="text-[15px] font-semibold text-foreground">
                      {masterAccount.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.balance) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Latency</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[15px] font-semibold text-emerald-500">42ms</p>
                      <svg className="w-3 h-3 text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Floating P/L</p>
                    <p className={`text-[15px] font-semibold ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.floatingPl || 0)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">No Master Account</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] mb-4">
                  Connect an account to start copying.
                </p>
                <button className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  Connect
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SUB ACCOUNTS */}
        <section className="lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Sub Accounts</h2>
            <button className="text-[13px] text-muted-foreground hover:text-foreground font-medium transition-colors bg-secondary px-3 py-1 rounded-full border border-border/50">View all</button>
          </div>
          
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex-1">
            {subAccounts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                {subAccounts.map((sub, idx) => (
                  <div key={sub.id} className="bg-background rounded-[16px] border border-border/50 p-4 shadow-sm flex flex-col justify-between transition-colors hover:border-primary/40 group">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center border border-border/50 text-primary group-hover:bg-primary/10 transition-colors">
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-foreground leading-none mb-1">{sub.login}</p>
                            <p className="text-[11px] text-muted-foreground">MT5 • {sub.isDemo ? 'Demo' : 'Live'}</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted border-border'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                          <span className="text-[10px] font-medium">{sub.isActive ? 'Copying' : 'Paused'}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Balance</p>
                          <p className="text-[13px] font-semibold text-foreground">
                            {sub.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.balance) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Today's P/L</p>
                          <p className={`text-[13px] font-semibold ${(sub.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                            {(sub.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.floatingPl || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Risk</p>
                          <p className="text-[13px] font-semibold text-foreground">
                            {sub.copySettings?.riskMultiplier ? (sub.copySettings.riskMultiplier * 100).toFixed(0) : 100}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Decorative Sparkline */}
                    <div className="h-6 mt-4 opacity-50 pointer-events-none">
                      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-full stroke-primary fill-none" strokeWidth="1.5">
                        <path d="M0,10 C15,15 25,5 40,10 C55,15 65,0 80,10 C90,15 100,5 100,5" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 h-full flex flex-col items-center justify-center text-center py-10">
                <Users className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">No Sub Accounts yet</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Connect an account to start copying trades.
                </p>
                <button className="bg-secondary border border-border/50 text-foreground px-4 py-1.5 rounded-lg text-[13px] font-medium hover:bg-secondary/80 transition-colors">
                  Add Account
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MAIN CONTENT GRID - ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* PERFORMANCE CHART */}
        <section className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Performance</h2>
            <div className="relative">
              <select className="appearance-none bg-secondary text-[11px] font-medium text-foreground px-3 py-1 pr-6 rounded-full border border-border/50 focus:outline-none focus:border-primary/50 cursor-pointer">
                <option>7D</option>
                <option>30D</option>
                <option>All Time</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex-1 flex flex-col">
            <div className="mb-4">
              <div className={`text-[22px] font-bold tracking-tight ${(todaysTotalPl + 4.8) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {(todaysTotalPl + 4.8) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaysTotalPl + 4.8)}
                <span className="text-[12px] font-medium text-emerald-500 ml-3 inline-flex items-center gap-0.5">
                  <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                  4.82%
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[160px] -mx-2 -mb-2">
              <PerformanceChart data={chartData} />
            </div>
          </div>
        </section>

        {/* RECENT ACTIVITY TIMELINE */}
        <section className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Recent Activity</h2>
            <button className="text-[13px] text-muted-foreground hover:text-foreground font-medium transition-colors bg-secondary px-3 py-1 rounded-full border border-border/50">View all</button>
          </div>
          
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex-1">
            {recentActivity.length > 0 ? (
              <div className="relative pl-3 space-y-6 before:absolute before:inset-y-0 before:left-4 before:w-[1px] before:bg-border/60">
                {recentActivity.map((activity, idx) => {
                  const isExecuted = activity.state === 'EXECUTED';
                  const isFailed = activity.state === 'FAILED' || activity.state === 'REJECTED';
                  return (
                    <div key={activity.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <span className={`absolute left-[-17px] top-1 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center ${isExecuted ? 'bg-emerald-500' : isFailed ? 'bg-destructive' : 'bg-primary'}`}>
                        {isExecuted ? (
                          <svg className="w-2 h-2 text-background" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                        ) : isFailed ? (
                          <svg className="w-2 h-2 text-background" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        ) : (
                          <svg className="w-2 h-2 text-background" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        )}
                      </span>
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground leading-none mb-1">
                            {isExecuted ? 'Trade Copied' : isFailed ? 'Trade Failed' : 'Position Modified'}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {activity.signal?.symbol} • {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.volume} lots • {activity.subAccount?.login}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                           {/* Simple mock time ago logic for visual sake */}
                           {idx === 0 ? '2m ago' : idx === 1 ? '8m ago' : idx === 2 ? '15m ago' : '1h ago'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <Activity className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              </div>
            )}
          </div>
        </section>

        {/* RISK OVERVIEW */}
        <section className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Risk Overview</h2>
            <button className="text-[13px] text-muted-foreground hover:text-foreground font-medium transition-colors bg-secondary px-3 py-1 rounded-full border border-border/50">View all</button>
          </div>
          
          <div className="bg-card rounded-[20px] border border-border/40 p-5 shadow-sm flex-1 flex flex-col">
            <h3 className="text-[12px] font-medium text-muted-foreground mb-1">Daily Risk</h3>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-[32px] font-bold text-foreground leading-none">12%</span>
              <span className="text-[12px] text-muted-foreground mb-1 font-medium">$120 / $1,000</span>
            </div>
            
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden mb-6 flex">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '12%' }}></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="bg-background rounded-[12px] border border-border/50 p-3 flex flex-col justify-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Used</span>
                <span className="text-[15px] font-semibold text-emerald-500">$120.00</span>
              </div>
              <div className="bg-background rounded-[12px] border border-border/50 p-3 flex flex-col justify-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Remaining</span>
                <span className="text-[15px] font-semibold text-foreground">$880.00</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground">Resets in 08:23:47</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
