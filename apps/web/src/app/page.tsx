import { ShieldAlert, ArrowUpRight, ArrowDownRight, Settings2, BarChart3, Wifi, Clock, ArrowRight, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ThemeToggle } from '@/components/theme-toggle';
import { CurrencySelector } from '@/components/currency-selector';
import { MoneyDisplay } from '@/components/money-display';
import Link from 'next/link';

export default async function DashboardOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // ==========================================
  // BACKEND DATA FETCHING (PRESERVED EXACTLY)
  // ==========================================
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

  // ==========================================
  // DATA PROCESSING (PRESERVED EXACTLY)
  // ==========================================
  const masterAccounts = accounts.filter((a: any) => a.role === 'MASTER');
  const subAccounts = accounts.filter((a: any) => a.role === 'SUB');
  const activeSubs = subAccounts.filter((a: any) => a.isActive).length;
  
  const isOnline = (token: any) => {
    if (!token?.lastUsedAt) return false;
    return new Date().getTime() - new Date(token.lastUsedAt).getTime() < 5 * 60 * 1000;
  };

  const masterToken = masterAccount?.eaTokens?.[0];
  const masterOnline = masterAccount?.isActive && isOnline(masterToken);
  
  const onlineSubs = subAccounts.filter((sub: any) => sub.isActive && isOnline(sub.eaTokens?.[0])).length;
  const allConnected = masterOnline && onlineSubs === subAccounts.length;

  const closedProfit = todayDeals.reduce((sum, deal) => sum + deal.profit + deal.commission + deal.swap, 0);
  const floatingPl = accounts.reduce((sum, a) => sum + (a.floatingPl || 0), 0);
  const todaysTotalPl = closedProfit + floatingPl;
  
  const isProfit = todaysTotalPl >= 0;

  // Since we do not have a dedicated historical time-series endpoint for performance,
  // we pass an empty array to trigger the real honest empty state in the chart.
  const chartData: any[] = [];

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      
      {/* Removed heavy blue gradients in favor of subtle environment lighting */}

      {/* HEADER: Calm & Intentional */}
      <header className="relative z-50 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Good morning, Admin
            </h1>
            {/* Functional Status Pill */}
            {allConnected ? (
              <div className="pill pill-success shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Copying
              </div>
            ) : (
              <div className="pill pill-neutral text-destructive border-destructive/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></span>
                Degraded
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-[13px] tracking-wide">
            {activeSubs} of {subAccounts.length} portfolio accounts routing normally.
          </p>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-4">
          <CurrencySelector />
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden shadow-sm border border-border/50">
            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Admin&backgroundColor=transparent`} alt="Admin" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* MAIN COMPOSITION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 relative z-10 mt-2">
        
        {/* =========================================
            LEFT COLUMN (PRIMARY FOCUS) 
            ========================================= */}
        <div className="xl:col-span-7 flex flex-col gap-12">
          
          {/* HERO: TODAY'S P/L */}
          <section className="relative flex flex-col pt-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-4">Today's Performance</h2>
            
            <div className={`text-[64px] sm:text-[96px] font-bold tracking-tighter leading-none num-tabular ${isProfit ? 'text-foreground' : 'text-destructive'}`}>
              {isProfit ? '+' : ''}<MoneyDisplay amount={todaysTotalPl} sourceCurrency="USD" />
            </div>
            
            <div className="mt-8 flex items-center gap-8 border-t border-border/40 pt-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Execution</span>
                <span className="text-[20px] font-semibold text-foreground tracking-tight num-tabular">{copiedTradesToday} <span className="text-[13px] text-muted-foreground font-normal">trades</span></span>
              </div>
              <div className="w-[1px] h-8 bg-border/40"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Routing</span>
                <span className="text-[20px] font-semibold text-foreground tracking-tight num-tabular">{activeSubs} <span className="text-[13px] text-muted-foreground font-normal">/ {subAccounts.length}</span></span>
              </div>
            </div>
          </section>

          {/* MASTER ACCOUNT: Functional Digital Card */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">Master Sources & Portfolios</h3>
            
            {masterAccounts.length > 0 ? (
              <div className="flex flex-col gap-10">
                {masterAccounts.map((master: any) => {
                  const masterOnline = isOnline(master.eaTokens?.[0]);
                  // Currently mocking the relationship. In the future this will be `master.subAccounts`
                  const tiedSubs = subAccounts; 
                  
                  return (
                    <div key={master.id} className="flex flex-col gap-4">
                      <Link href="/master" className="group block digital-card p-6 rounded-[20px]">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <div className="pill pill-neutral text-[10px] uppercase tracking-widest">{master.broker || 'Unknown'}</div>
                              <div className={`pill text-[10px] ${masterOnline ? 'pill-success' : 'pill-destructive'}`}><Wifi className="w-3 h-3" /> {masterOnline ? 'Connected' : 'Offline'}</div>
                            </div>
                            <h4 className="text-[28px] font-bold text-foreground tracking-tighter leading-none group-hover:text-primary transition-colors">{master.login}</h4>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="bg-card/50 px-4 py-2 rounded-xl border border-border/30 text-right">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Balance</p>
                              <p className="text-[16px] font-semibold text-foreground num-tabular leading-none">
                                {master.balance != null ? <MoneyDisplay amount={master.balance} sourceCurrency={master.currency || 'USD'} /> : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border/20">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Equity</span>
                            <span className="text-[15px] font-semibold text-foreground num-tabular">
                              {master.equity != null ? <MoneyDisplay amount={master.equity} sourceCurrency={master.currency || 'USD'} /> : 'N/A'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Floating P/L</span>
                            <span className={`text-[15px] font-semibold num-tabular ${(master.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                              {(master.floatingPl || 0) >= 0 ? '+' : ''}<MoneyDisplay amount={master.floatingPl || 0} sourceCurrency={master.currency || 'USD'} />
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Tied Sub Accounts */}
                      {tiedSubs.length > 0 && (
                        <div className="ml-6 pl-6 border-l-2 border-border/20 flex flex-col gap-3">
                          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-2 mb-1">Tied Portfolios</h4>
                          {tiedSubs.map((sub: any) => (
                            <Link key={sub.id} href="/risk" className="group surface-matte p-4 rounded-[16px] flex items-center justify-between hover:bg-black/10 dark:hover:bg-white/5 border border-border/30 transition-all cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-border/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                  <Users className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                  <div className="text-[13px] font-bold text-foreground leading-none">{sub.login}</div>
                                  <div className="text-[10px] text-muted-foreground mt-1">{sub.broker}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[13px] font-semibold text-foreground num-tabular"><MoneyDisplay amount={sub.balance || 0} sourceCurrency={sub.currency || 'USD'} /></div>
                                <div className="text-[10px] text-muted-foreground mt-1">Multiplier: {sub.copySettings?.riskMultiplier || 1.0}x</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="hero-panel p-8 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-8 h-8 mb-3 text-muted-foreground" />
                <p className="text-[13px] font-medium text-foreground">No Master Source</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-4">A master account is required to copy trades.</p>
                <Link href="/master" className="btn-apple btn-secondary">Connect Master</Link>
              </div>
            )}
          </section>
        </div>

        {/* =========================================
            RIGHT COLUMN (SECONDARY CONTEXT) 
            ========================================= */}
        <div className="xl:col-span-5 flex flex-col gap-10">
          
          {/* THE REAL CHART */}
          <section className="premium-glass p-6 rounded-[24px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Performance</h3>
              {/* Fake timeframe controls removed as per user instruction for honest functionality */}
            </div>
            <div className="h-[220px] -mx-4 -mb-4">
              <PerformanceChart data={chartData} />
            </div>
          </section>

          {/* RISK CONFIGURATION */}
          <section className="surface-matte p-6 rounded-[20px]">
             <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Risk Engine</h3>
              <button className="pill pill-interactive pill-neutral text-[10px] hover:bg-black/5 dark:hover:bg-white/5">
                <Settings2 className="w-3.5 h-3.5 mr-1" /> Configure
              </button>
             </div>

             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
                  <span className="text-[13px] font-medium text-foreground">Allocation</span>
                  <span className="text-[13px] font-semibold text-primary">Custom per Account</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
                  <span className="text-[13px] font-medium text-foreground">Daily Risk Limit</span>
                  <span className="pill pill-neutral">Not Configured</span>
                </div>
             </div>
          </section>

          {/* ACTIVITY */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold px-1">Activity</h3>
              <Link href="/activity" className="text-[11px] text-primary hover:underline font-medium px-1">View all</Link>
            </div>
            
            <div className="glass-panel rounded-[20px] overflow-hidden">
              {recentActivity.length > 0 ? (
                <div className="flex flex-col divide-y divide-border/30">
                  {recentActivity.slice(0, 4).map((activity) => (
                    <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.state === 'EXECUTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                          {activity.signal?.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-foreground leading-tight">
                            {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.volume} {activity.signal?.symbol}
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            {activity.subAccount?.login}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Clock className="w-6 h-6 mb-2 opacity-50" />
                  <span className="text-[12px]">No recent activity</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      
      {/* SUB ACCOUNTS PORTFOLIO */}
      <section className="relative z-10 mt-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold px-1">Sub Accounts</h3>
          <Link href="/accounts" className="text-[11px] text-primary hover:underline font-medium px-1 flex items-center gap-1">Manage <ArrowRight className="w-3 h-3" /></Link>
        </div>
        
        {subAccounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {subAccounts.map((sub) => (
              <Link key={sub.id} href="/accounts" className="group glass-panel p-5 rounded-[16px] hover:border-border/80 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-[16px] font-bold text-foreground tracking-tight group-hover:text-primary transition-colors leading-none">{sub.login}</h4>
                    <span className="text-[11px] text-muted-foreground mt-1 block">{sub.broker || 'Unknown'}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${sub.isActive && isOnline(sub.eaTokens?.[0]) ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}></div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-0.5">Balance</span>
                    <span className="text-[13px] font-semibold text-foreground num-tabular">
                      {sub.balance != null ? <MoneyDisplay amount={sub.balance} sourceCurrency={sub.currency || 'USD'} /> : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-0.5">P/L</span>
                    <span className={`text-[13px] font-semibold num-tabular ${sub.floatingPl && sub.floatingPl > 0 ? 'text-emerald-500' : sub.floatingPl && sub.floatingPl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {sub.floatingPl && sub.floatingPl > 0 ? '+' : ''}{sub.floatingPl ? <MoneyDisplay amount={sub.floatingPl} sourceCurrency={sub.currency || 'USD'} /> : '$0.00'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-8 rounded-[20px] flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 mb-3 text-muted-foreground opacity-50" />
            <p className="text-[13px] font-medium text-foreground">No Sub Accounts</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">Connect portfolio accounts to receive trades.</p>
            <Link href="/accounts" className="btn-apple btn-secondary">Add Account</Link>
          </div>
        )}
      </section>

    </div>
  );
}
