import { Activity, ShieldCheck, ArrowUpRight, Wifi, ShieldAlert, ArrowRightLeft, Users, Clock, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function DashboardOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch Data (Backend Logic Intact)
  let accounts: any[] = [];
  let todayDeals: any[] = [];
  let copiedTradesToday = 0;
  let recentActivity: any[] = [];

  try {
    accounts = await prisma.mt5Account.findMany({
      include: {
        copySettings: true,
        eaTokens: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    todayDeals = await prisma.deal.findMany({
      where: { time: { gte: startOfDay } }
    });

    copiedTradesToday = await prisma.tradeCopy.count({
      where: { createdAt: { gte: startOfDay }, state: 'EXECUTED' }
    });

    recentActivity = await prisma.tradeCopy.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        signal: true,
        subAccount: true
      }
    });
  } catch (err) {
    console.warn("Database unreachable, using empty arrays to allow UI render:", err);
  }

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
  const closedProfit = todayDeals.reduce((sum, deal) => sum + deal.profit + deal.commission + deal.swap, 0);
  const floatingPl = accounts.reduce((sum, a) => sum + (a.floatingPl || 0), 0);
  const todaysTotalPl = closedProfit + floatingPl;
  
  const isProfit = todaysTotalPl >= 0;

  // Mocked Chart Data
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
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-12 pb-32 overflow-y-auto custom-scrollbar relative">
      
      {/* ATMOSPHERIC BACKGROUND ILLUMINATION */}
      <div className="ambient-light ambient-blue w-[600px] h-[600px] -top-[200px] -left-[100px] z-0"></div>
      <div className="ambient-light ambient-cyan w-[400px] h-[400px] top-[20%] right-[-100px] z-0 opacity-[0.05]"></div>

      {/* HEADER: Floating liquid navigation style */}
      <header className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Good morning, Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-[13px] tracking-wide">
            System is {allConnected ? 'routing normally' : 'degraded'} across {subAccounts.length} accounts.
          </p>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-b border-border/60 pl-2 pr-8 py-1.5 text-sm focus:outline-none focus:border-primary w-[200px] text-foreground placeholder:text-muted-foreground transition-colors"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50">
              <span className="text-[9px] font-medium tracking-widest uppercase">⌘K</span>
            </div>
          </div>
          
          <div className="hidden lg:block ml-4">
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-3 pl-4">
            <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden shadow-sm">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Admin&backgroundColor=transparent`} alt="Admin" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN COMPOSITION (BORDERLESS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 relative z-10 mt-4">
        
        {/* =========================================
            LEFT COLUMN (THE CANVAS) 
            ========================================= */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-16 order-2 lg:order-1">
          
          {/* HERO INSTRUMENT: Naked on the canvas */}
          <section className="relative min-h-[340px] flex flex-col">
            
            {/* The Integrated Chart - Fading into the void */}
            <div 
              className="absolute -inset-x-8 -top-8 bottom-0 z-0 opacity-40 dark:opacity-60 mix-blend-plus-lighter pointer-events-none"
              style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 95%)', WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 95%)' }}
            >
              <PerformanceChart data={chartData} />
            </div>

            <div className="relative z-10 mt-8">
              <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-4">Today's Performance</h2>
              
              {/* Massive Typographic Display */}
              <div className={`text-[80px] sm:text-[100px] xl:text-[120px] font-bold tracking-tighter leading-[0.9] data-illuminated ${isProfit ? 'text-foreground' : 'text-destructive'}`}>
                {isProfit ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(todaysTotalPl)}
              </div>
              
              <div className="mt-8 flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Execution</span>
                  <span className="text-[24px] font-semibold text-foreground tracking-tight">{copiedTradesToday} <span className="text-[14px] text-muted-foreground font-normal">trades</span></span>
                </div>
                <div className="w-[1px] h-8 bg-border/60"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Routing</span>
                  <span className="text-[24px] font-semibold text-foreground tracking-tight">{activeSubs} <span className="text-[14px] text-muted-foreground font-normal">/ {subAccounts.length}</span></span>
                </div>
              </div>
            </div>
          </section>

          {/* SUB ACCOUNTS PORTFOLIO (Seamless List) */}
          <section className="mt-8">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-6">Connected Portfolio</h3>
            
            {subAccounts.length > 0 ? (
              <div className="flex flex-col divide-y divide-border/40">
                {subAccounts.map((sub) => (
                  <div key={sub.id} className="group py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-4 px-4 rounded-xl">
                    <div className="flex items-center gap-4">
                      {/* Status Dot */}
                      <div className={`w-2 h-2 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/40'}`}></div>
                      <div>
                        <p className="text-[15px] font-bold text-foreground tracking-tight">{sub.login}</p>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">{sub.broker}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-12 sm:gap-16">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Balance</span>
                        <span className="text-[15px] font-semibold text-foreground tabular-nums">
                          {sub.balance != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.balance) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end w-24">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">P/L</span>
                        <span className={`text-[15px] font-semibold tabular-nums ${sub.floatingPl && sub.floatingPl > 0 ? 'text-emerald-500' : sub.floatingPl && sub.floatingPl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {sub.floatingPl && sub.floatingPl > 0 ? '+' : ''}{sub.floatingPl ? new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency || 'USD' }).format(sub.floatingPl) : '$0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-muted-foreground text-sm">No portfolio accounts connected.</div>
            )}
          </section>

          {/* ACTIVITY (Editorial Timeline) */}
          <section className="mt-8">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-8">System Ledger</h3>
            
            <div className="relative">
              {recentActivity.length > 0 ? (
                <div className="space-y-0">
                  {recentActivity.map((activity, idx) => {
                    const isExecuted = activity.state === 'EXECUTED';
                    const isFailed = activity.state === 'FAILED' || activity.state === 'REJECTED';
                    return (
                      <div key={activity.id} className="relative flex gap-8 pb-10 last:pb-0">
                        {/* Connecting Line */}
                        {idx !== recentActivity.length - 1 && (
                          <div className="absolute left-[3px] top-6 bottom-[-10px] w-[1px] bg-border/40"></div>
                        )}
                        
                        {/* Minimal Indicator */}
                        <div className="mt-1">
                          <div className={`w-2 h-2 rounded-full ring-4 ring-background ${isExecuted ? 'bg-emerald-500' : isFailed ? 'bg-destructive' : 'bg-primary'}`}></div>
                        </div>
                        
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 -mt-1.5">
                          <div>
                            <p className="text-[15px] font-medium text-foreground tracking-tight">
                              {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.volume} {activity.signal?.symbol}
                            </p>
                            <p className="text-[12px] text-muted-foreground mt-1 tracking-wide">
                              {isExecuted ? 'Executed on' : isFailed ? 'Failed on' : 'Processing for'} {activity.subAccount?.login}
                            </p>
                          </div>
                          <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
                            {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-muted-foreground text-sm">Ledger is empty.</div>
              )}
            </div>
          </section>
        </div>

        {/* =========================================
            RIGHT COLUMN (Physical & Technical Objects) 
            ========================================= */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-12 order-1 lg:order-2">
          
          {/* THE MASTER ACCOUNT: Tactile Physical Card */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4 px-1">Master Source</h3>
            
            <div className="surface-matte p-8 flex flex-col min-h-[340px]">
              {masterAccount ? (
                <>
                  <div className="flex items-start justify-between mb-auto">
                    <div>
                      <div className="inline-flex items-center px-2 py-1 rounded bg-black/5 dark:bg-white/5 text-[10px] text-foreground uppercase tracking-widest font-semibold mb-4">
                        {masterAccount.broker}
                      </div>
                      <h3 className="text-[28px] font-bold text-foreground tracking-tighter leading-none">{masterAccount.login}</h3>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${masterOnline ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-destructive'}`}></div>
                    </div>
                  </div>
                  
                  <div className="mt-12 space-y-6">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">Total Equity</span>
                      <span className="text-[24px] font-bold text-foreground tabular-nums tracking-tight">
                        {masterAccount.equity != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.equity) : 'N/A'}
                      </span>
                    </div>
                    <div className="w-full h-[1px] bg-border/40"></div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">Floating</span>
                      <span className={`text-[18px] font-semibold tabular-nums tracking-tight ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: masterAccount.currency || 'USD' }).format(masterAccount.floatingPl || 0)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                  <ShieldAlert className="w-8 h-8 mb-4 opacity-50" />
                  <p className="text-[12px] uppercase tracking-widest font-medium">Source Disconnected</p>
                </div>
              )}
            </div>
          </section>

          {/* THE RISK INSTRUMENT: Pure Visualization */}
          <section className="mt-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-6 px-1">Risk Instrument</h3>
            
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Background Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="96" cy="96" r="88" className="stroke-black/5 dark:stroke-white/5 fill-none" strokeWidth="4" />
                  {/* Glowing Active Ring (12%) */}
                  <circle cx="96" cy="96" r="88" className="stroke-accent fill-none drop-shadow-[0_0_16px_rgba(0,212,255,0.4)] transition-all duration-1000" strokeWidth="4" strokeDasharray="552.9" strokeDashoffset={552.9 - (552.9 * 0.12)} strokeLinecap="round" />
                </svg>
                
                {/* Center Readout */}
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-[48px] font-bold text-foreground leading-none tracking-tighter data-illuminated-cyan">12<span className="text-[20px] text-muted-foreground ml-1">%</span></span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-2">Daily Util</span>
                </div>
              </div>
              
              <div className="flex items-center gap-12 mt-10">
                <div className="flex flex-col items-center">
                  <span className="text-[16px] font-semibold text-foreground tracking-tight">$120</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-[0.1em] mt-1">Exposure</span>
                </div>
                <div className="w-[1px] h-6 bg-border/60"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[16px] font-semibold text-foreground tracking-tight">$1,000</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-[0.1em] mt-1">Limit</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
