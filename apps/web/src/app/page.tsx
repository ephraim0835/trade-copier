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
    <div className="flex-1 p-4 md:p-6 lg:p-10 flex flex-col gap-8 pb-24 lg:pb-12 overflow-y-auto custom-scrollbar">
      
      {/* HEADER ROW */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Good morning, Admin! <span className="text-2xl">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-[14px]">
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
          
          <button className="relative w-10 h-10 rounded-full bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></span>
          </button>
          
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          <div className="hidden md:flex items-center gap-3 pl-3 border-l border-border/50">
            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border/40 shadow-sm">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Admin&backgroundColor=transparent`} alt="Admin" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-foreground leading-none">Admin</span>
              <span className="text-[11px] text-muted-foreground mt-1">Administrator</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN ART-DIRECTED COMPOSITION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* =========================================
            LEFT COLUMN (Focal Area) 
            ========================================= */}
        <div className="lg:col-span-8 flex flex-col gap-8 order-2 lg:order-1">
          
          {/* HERO INSTRUMENT: P/L & Performance */}
          <section className="relative overflow-hidden rounded-[32px] hero-panel min-h-[380px] lg:min-h-[420px] flex flex-col group">
            {/* Embedded Chart Background */}
            <div 
              className="absolute inset-0 z-0 opacity-40 dark:opacity-[0.25] pointer-events-none mix-blend-plus-lighter" 
              style={{ maskImage: 'linear-gradient(to bottom, transparent 5%, black 90%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 5%, black 90%)' }}
            >
              <PerformanceChart data={chartData} />
            </div>
            
            {/* Top Area: Label */}
            <div className="relative z-10 p-8 lg:p-10 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-[14px] leading-none">$</span>
                  </div>
                  <h2 className="text-[12px] font-semibold text-muted-foreground tracking-widest uppercase">Today's Profit</h2>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                  +4.82% vs yesterday
                </div>
              </div>
              
              {/* Massive Financial Number */}
              <div className="mt-8 lg:mt-12">
                <div className={`text-[56px] lg:text-[72px] font-bold tracking-tighter leading-none ${isProfit ? 'text-foreground' : 'text-destructive'}`} style={{ textShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                  {isProfit ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(todaysTotalPl)}
                </div>
              </div>
            </div>

            {/* Bottom Area: Inline Metrics (NOT Cards) */}
            <div className="relative z-10 px-8 lg:px-10 pb-8 flex flex-wrap items-center gap-8 lg:gap-12 mt-auto">
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Copied Trades</span>
                <span className="text-[20px] font-semibold text-foreground">{copiedTradesToday}</span>
              </div>
              <div className="w-[1px] h-8 bg-border/40 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Active Subs</span>
                <span className="text-[20px] font-semibold text-primary">{activeSubs} <span className="text-muted-foreground text-[14px]">/ {subAccounts.length}</span></span>
              </div>
            </div>
          </section>

          {/* SUB ACCOUNTS GRID (Compact Premium Items) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[12px] uppercase tracking-widest text-muted-foreground font-semibold">Sub Accounts</h3>
              <button className="text-[11px] text-primary hover:text-primary/80 uppercase tracking-widest font-bold transition-colors">Manage</button>
            </div>
            
            {subAccounts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subAccounts.map((sub) => (
                  <div key={sub.id} className="mini-card rounded-[20px] p-5 flex flex-col justify-between group h-[140px]">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border/50 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-foreground leading-tight">{sub.login}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{sub.broker}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground'}`}></div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Balance</p>
                        <p className="text-[15px] font-semibold text-foreground">
                          {sub.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.balance) : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Today P/L</p>
                        <p className={`text-[13px] font-semibold ${sub.floatingPl && sub.floatingPl > 0 ? 'text-emerald-500' : sub.floatingPl && sub.floatingPl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {sub.floatingPl && sub.floatingPl > 0 ? '+' : ''}{sub.floatingPl ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.floatingPl) : '$0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-center opacity-60 rounded-[20px] border border-dashed border-border">
                <p className="text-sm font-medium">No Sub Accounts Connected</p>
              </div>
            )}
          </section>

          {/* ACTIVITY (Editorial Layout, No Heavy Card) */}
          <section className="flex flex-col gap-6 mt-4">
            <div className="flex items-center justify-between px-1 border-b border-border/30 pb-4">
              <h3 className="text-[12px] uppercase tracking-widest text-muted-foreground font-semibold">Recent Activity</h3>
              <button className="text-[11px] text-foreground hover:text-primary uppercase tracking-widest font-bold transition-colors">View Timeline</button>
            </div>
            
            <div className="px-2">
              {recentActivity.length > 0 ? (
                <div className="space-y-0">
                  {recentActivity.map((activity, idx) => {
                    const isExecuted = activity.state === 'EXECUTED';
                    const isFailed = activity.state === 'FAILED' || activity.state === 'REJECTED';
                    return (
                      <div key={activity.id} className="group relative flex gap-6 pb-8 last:pb-0">
                        {/* Thin vertical line connecting dots */}
                        {idx !== recentActivity.length - 1 && (
                          <div className="absolute left-[11px] top-7 bottom-[-16px] w-[1px] bg-border/40 group-hover:bg-primary/30 transition-colors"></div>
                        )}
                        
                        {/* Minimal Dot Indicator */}
                        <div className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-background ${isExecuted ? 'bg-emerald-500/20 text-emerald-500' : isFailed ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isExecuted ? 'bg-emerald-500' : isFailed ? 'bg-destructive' : 'bg-primary'}`}></div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                          <div>
                            <p className="text-[14px] font-semibold text-foreground">
                              {isExecuted ? 'Market Execution' : isFailed ? 'Execution Failed' : 'Signal Processing'}
                            </p>
                            <p className="text-[12px] text-muted-foreground mt-1">
                              {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.volume} {activity.signal?.symbol}
                              <span className="mx-2 opacity-50">•</span> 
                              <span className="text-foreground/80">{activity.subAccount?.login}</span>
                            </p>
                          </div>
                          <div className="text-[11px] font-medium text-muted-foreground mt-1 sm:mt-0">
                            {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 opacity-60 flex items-center gap-3">
                  <Activity className="w-5 h-5" />
                  <p className="text-sm font-medium">No recent activity on your accounts.</p>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* =========================================
            RIGHT COLUMN (Supporting Instruments) 
            ========================================= */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:gap-8 order-1 lg:order-2">
          
          {/* MASTER ACCOUNT (Digital Identity Card) */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[12px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Master Identity</h3>
            
            <div className="digital-card rounded-[28px] p-6 sm:p-8 flex flex-col min-h-[300px]">
              {masterAccount ? (
                <>
                  {/* Header: Broker & Status */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="px-3 py-1 rounded-full bg-black/40 dark:bg-black/60 border border-white/5 text-[10px] text-white/90 font-medium tracking-wide shadow-inner">
                      {masterAccount.broker}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${masterOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {masterOnline ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Body: Account Name / Login */}
                  <div className="mb-auto">
                    <h3 className="text-[24px] font-bold text-foreground tracking-tight">{masterAccount.login}</h3>
                    <p className="text-[12px] text-muted-foreground mt-1">Primary Signal Source</p>
                  </div>
                  
                  {/* Footer: Financial Details */}
                  <div className="mt-10 space-y-4">
                    <div className="flex justify-between items-end border-b border-border/30 pb-3">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-widest">Equity</span>
                      <span className="text-[20px] font-bold text-foreground leading-none">
                        {masterAccount.equity != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.equity) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end pb-1">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-widest">Floating P/L</span>
                      <span className={`text-[16px] font-bold leading-none ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
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

          {/* RISK INSTRUMENT (Radial Gauge) */}
          <section className="flex flex-col gap-4">
            <h3 className="text-[12px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Risk Instrument</h3>
            
            <div className="bg-card/60 dark:bg-[#0f0f15]/80 rounded-[28px] border border-border/40 p-8 shadow-sm flex flex-col items-center relative overflow-hidden backdrop-blur-xl">
              <div className="relative w-40 h-40 flex items-center justify-center my-2">
                {/* Background Track */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="72" className="stroke-secondary fill-none" strokeWidth="6" />
                  {/* Foreground Glow Ring (12% filled as example) */}
                  <circle cx="80" cy="80" r="72" className="stroke-accent fill-none drop-shadow-[0_0_12px_rgba(63,236,255,0.7)] transition-all duration-1000" strokeWidth="6" strokeDasharray="452.4" strokeDashoffset={452.4 - (452.4 * 0.12)} strokeLinecap="round" />
                </svg>
                {/* Center Readout */}
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-[36px] font-bold text-foreground leading-none tracking-tighter">12<span className="text-[18px] text-muted-foreground">%</span></span>
                </div>
              </div>
              
              <div className="w-full grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/40">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Exposure</span>
                  <span className="text-[15px] font-semibold text-foreground">$120.00</span>
                </div>
                <div className="flex flex-col items-center text-center border-l border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Daily Limit</span>
                  <span className="text-[15px] font-semibold text-foreground">$1,000.00</span>
                </div>
              </div>
            </div>
          </section>
          
          {/* SYSTEM HEALTH STACK */}
          <section className="flex flex-col gap-3 mt-2">
             <div className={`rounded-[20px] border p-5 flex items-center justify-between transition-colors ${allConnected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-destructive/20 bg-destructive/5'}`}>
               <div className="flex items-center gap-4">
                 <div className={`w-2.5 h-2.5 rounded-full ${allConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`}></div>
                 <div>
                   <p className="text-[14px] font-bold text-foreground">Engine Status</p>
                   <p className="text-[11px] text-muted-foreground mt-0.5">{allConnected ? 'Routing Active' : 'Connection Degraded'}</p>
                 </div>
               </div>
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
