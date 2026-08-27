import { ShieldAlert, ArrowUpRight, ArrowDownRight, Settings2, BarChart3, Wifi, Clock, ArrowRight, Users, Play, Home, Globe } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { ThemeToggle } from '@/components/theme-toggle';
import { CurrencySelector } from '@/components/currency-selector';
import { LogoutButton } from '@/components/logout-button';
import { MoneyDisplay } from '@/components/money-display';
import { MultiMoneyDisplay } from '@/components/multi-money-display';
import { ProtectedAction } from '@/components/protected-action';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  // AUTO-FIX DATABASE SCHEMA DRIFT
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
    await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" ALTER COLUMN "riskPercentage" SET DEFAULT 1.0');
  } catch (e) { /* Ignore if already renamed */ }
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "AccountSubscription" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
  } catch (e) { /* Ignore if already renamed */ }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  // ==========================================
  // BACKEND DATA FETCHING (TENANT ISOLATED)
  // ==========================================
  let accounts: any[] = [];
  let todayDeals: any[] = [];
  let copiedTradesToday = 0;
  let recentActivity: any[] = [];

  try {
    accounts = await prisma.mt5Account.findMany({
      where: { userId: user.id },
      include: {
        copySettings: true,
        eaTokens: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    todayDeals = await prisma.deal.findMany({
      where: { 
        time: { gte: startOfDay },
        mt5Account: { userId: user.id }
      },
      include: {
        mt5Account: true
      }
    });

    copiedTradesToday = await prisma.tradeCopy.count({
      where: { 
        createdAt: { gte: startOfDay }, 
        state: 'EXECUTED',
        subAccount: { userId: user.id }
      }
    });

    recentActivity = await prisma.tradeCopy.findMany({
      where: { subAccount: { userId: user.id } },
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
  const masterAccount = accounts.find((a: any) => a.role === 'MASTER');
  const subAccounts = accounts.filter((a: any) => a.role === 'SUB');
  const activeSubs = subAccounts.filter((a: any) => a.isActive).length;
  
  const isOnline = (account: any) => {
    if (!account?.updatedAt) return false;
    return new Date().getTime() - new Date(account.updatedAt).getTime() < 30_000;
  };

  const masterOnline = (masterAccount?.isActive ?? false) && isOnline(masterAccount);
  
  const onlineSubs = subAccounts.filter((sub: any) => sub.isActive && isOnline(sub)).length;
  const allConnected = masterOnline && onlineSubs === subAccounts.length;

  const totalBalanceArray = accounts.map((a: any) => ({
    amount: a.balance || 0,
    currency: a.currency || 'USD'
  }));

  const todaysTotalPlArray = [
    ...todayDeals.map((deal: any) => ({
      amount: deal.profit + deal.commission + deal.swap,
      currency: deal.mt5Account?.currency || 'USD'
    })),
    ...accounts.map((a: any) => ({
      amount: a.floatingPl || 0,
      currency: a.currency || 'USD'
    }))
  ];

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
            <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/80 dark:from-white dark:to-white/60">
              Hello, {user.name || user.email.split('@')[0]}
            </h1>
            {/* Functional Status Pill */}
            {accounts.length === 0 ? (
              <Link href="/master" className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm hover:bg-primary/20 transition-colors">
                <Play className="w-3 h-3 fill-primary" />
                GETTING STARTED
              </Link>
            ) : allConnected ? (
              <div className="plaiz-pill plaiz-pill-success shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Copying
              </div>
            ) : (
              <div className="plaiz-pill plaiz-pill-neutral text-destructive border-destructive/20 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></span>
                Degraded
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-[13px] tracking-wide">
            {accounts.length === 0 
              ? "Connect a master account to begin your copy setup." 
              : `${activeSubs} of ${subAccounts.length} portfolio accounts routing normally.`}
          </p>
        </div>
        
        {/* Top Right Utilities */}
        <div className="flex items-center gap-4">
          <a href="/?ref=dashboard" className="flex items-center gap-1.5 lg:gap-2 px-3 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors border border-border/50 text-muted-foreground hover:text-foreground">
            <Globe className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            <span className="hidden lg:block text-[11px] font-semibold tracking-wide uppercase">Website</span>
            <span className="lg:hidden text-[10px] font-bold tracking-wide uppercase">Web</span>
          </a>
          <CurrencySelector />
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <LogoutButton />
          <div className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center overflow-hidden shadow-sm border border-border/50 text-background font-bold text-[13px] tracking-tighter">
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* MAIN COMPOSITION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 relative z-10 mt-2">
        
        {/* =========================================
            LEFT COLUMN (PRIMARY FOCUS) 
            ========================================= */}
        <div className="xl:col-span-7 flex flex-col gap-12">
          
          {/* GLASS VAULT: PREMIUM BALANCE & PNL CARD */}
          <section className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br dark:from-primary/10 dark:via-transparent dark:to-transparent rounded-[24px] pointer-events-none transition-opacity duration-500"></div>
            <div className="relative bg-card dark:bg-slate-950/60 dark:backdrop-blur-3xl border border-border/50 dark:border-primary/20 rounded-[24px] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-primary/5 overflow-hidden transition-all duration-500">
              
              {/* Subtle accent glow */}
              <div className="hidden dark:block absolute -top-32 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/25 transition-colors duration-700"></div>
              <div className="hidden dark:block absolute -bottom-32 -left-32 w-80 h-80 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 sm:gap-8 flex-wrap lg:flex-nowrap">
                {/* Total Balance (Sum of master + all subs) */}
                <div className="flex flex-col z-10 min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    </div>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-semibold">Total Vault Balance</span>
                  </div>
                  <MultiMoneyDisplay 
                    balances={totalBalanceArray} 
                    className="text-[36px] sm:text-[44px] md:text-[48px] font-bold tracking-tighter leading-none num-tabular text-foreground break-words block"
                  />
                  <div className="mt-3 sm:mt-4 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-black/5 dark:bg-white/5 border border-border/50 rounded-md text-[10px] text-muted-foreground font-semibold">
                      {accounts.length} CONNECTED ACCOUNTS
                    </span>
                  </div>
                </div>

                {/* Live PnL */}
                <div className="flex flex-col sm:items-end z-10 shrink-0 min-w-0">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] mb-1.5 sm:mb-2 font-semibold sm:text-right">Live Floating PnL</span>
                  <div className="flex items-baseline gap-2">
                    <MultiMoneyDisplay 
                      balances={todaysTotalPlArray} 
                      colored={true} 
                      showSign={true} 
                      className="text-[28px] sm:text-[34px] md:text-[38px] font-bold tracking-tighter leading-none num-tabular"
                    />
                  </div>
                  
                  {/* Stats */}
                  <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 border-t border-border/30 pt-3 sm:pt-4 w-full sm:justify-end flex-wrap">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Execution</span>
                      <span className="text-[13px] font-semibold text-foreground num-tabular">{copiedTradesToday} trades</span>
                    </div>
                    <div className="w-[1px] h-6 bg-border/40"></div>
                    <div className="flex flex-col sm:items-end">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Routing</span>
                      <span className="text-[13px] font-semibold text-foreground num-tabular">{activeSubs} active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MASTER ACCOUNT: Functional Digital Card */}
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">Master Source</h3>
            
            {masterAccount ? (
              <Link href="/master" className="group block plaiz-card p-6 rounded-[20px]">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="plaiz-plaiz-pill plaiz-pill-neutral text-[10px] uppercase tracking-widest">{masterAccount.broker || 'Unknown'}</div>
                      <div className={`plaiz-pill text-[10px] ${masterOnline ? 'pill-success' : 'pill-destructive'}`}><Wifi className="w-3 h-3" /> {masterOnline ? 'Connected' : 'Offline'}</div>
                    </div>
                    <h4 className="text-[28px] font-bold text-foreground tracking-tighter leading-none group-hover:text-primary transition-colors">{masterAccount.login}</h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="bg-card/50 px-4 py-2 rounded-xl border border-border/30 text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Balance</p>
                      <p className="text-[16px] font-semibold text-foreground num-tabular leading-none">
                        {masterAccount.balance != null ? <MoneyDisplay amount={masterAccount.balance} sourceCurrency={masterAccount.currency || 'USD'} /> : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border/20">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Equity</span>
                    <span className="text-[15px] font-semibold text-foreground num-tabular">
                      {masterAccount.equity != null ? <MoneyDisplay amount={masterAccount.equity} sourceCurrency={masterAccount.currency || 'USD'} /> : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Floating P/L</span>
                    <span className={`text-[15px] font-semibold num-tabular ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}<MoneyDisplay amount={masterAccount.floatingPl || 0} sourceCurrency={masterAccount.currency || 'USD'} />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="plaiz-card bg-muted/50 p-8 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-8 h-8 mb-3 text-muted-foreground" />
                <p className="text-[13px] font-medium text-foreground">No Master Source</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-4">A master account is required to copy trades.</p>
                <ProtectedAction>
                  <Link href="/master" className="plaiz-btn plaiz-btn-secondary">Connect Master</Link>
                </ProtectedAction>
              </div>
            )}
          </section>

          {/* PORTFOLIO ACCOUNTS SECTION */}
          {subAccounts.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Portfolio Accounts</h3>
                <Link href="/risk" className="text-[11px] text-primary hover:underline font-medium">Manage</Link>
              </div>
              <div className="flex flex-col gap-3">
                {subAccounts.map((sub: any) => (
                  <Link key={sub.id} href="/risk" className="group plaiz-card bg-secondary/30 p-4 rounded-[16px] flex flex-col sm:flex-row sm:items-center justify-between hover:bg-black/10 dark:hover:bg-white/5 border border-border/30 transition-all cursor-pointer gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOnline(sub.eaTokens?.[0]) ? 'bg-success/10' : 'bg-black/5 dark:bg-white/5'}`}>
                        <Users className={`w-4 h-4 ${isOnline(sub.eaTokens?.[0]) ? 'text-success' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-foreground leading-none">{sub.login}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{sub.broker}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 sm:justify-end border-t sm:border-t-0 border-border/10 pt-3 sm:pt-0 mt-1 sm:mt-0">
                      <div className="flex flex-col sm:text-right">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Balance</span>
                        <span className="text-[13px] font-semibold text-foreground num-tabular"><MoneyDisplay amount={sub.balance || 0} sourceCurrency={sub.currency || 'USD'} /></span>
                      </div>
                      <div className="flex flex-col sm:text-right">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Live PnL</span>
                        <span className={`text-[13px] font-semibold num-tabular ${(sub.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                          {(sub.floatingPl || 0) >= 0 ? '+' : ''}<MoneyDisplay amount={sub.floatingPl || 0} sourceCurrency={sub.currency || 'USD'} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* =========================================
            RIGHT COLUMN (SECONDARY CONTEXT) 
            ========================================= */}
        <div className="xl:col-span-5 flex flex-col gap-10">
          
          {/* THE REAL CHART */}
          <section className="plaiz-card p-6 rounded-[24px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Performance</h3>
              {/* Fake timeframe controls removed as per user instruction for honest functionality */}
            </div>
            <div className="h-[220px] -mx-4 -mb-4">
              <PerformanceChart data={chartData} />
            </div>
          </section>

          {/* RISK CONFIGURATION */}
          <section className="plaiz-card bg-secondary/30 p-6 rounded-[20px]">
             <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Risk Engine</h3>
              <Link href="/risk">
                <button className="plaiz-pill plaiz-pill-neutral text-[10px] hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1">
                  <Settings2 className="w-3.5 h-3.5" /> Configure
                </button>
              </Link>
             </div>

             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
                  <span className="text-[13px] font-medium text-foreground">Allocation</span>
                  <span className="text-[13px] font-semibold text-primary">Custom per Account</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30">
                  <span className="text-[13px] font-medium text-foreground">Daily Risk Limit</span>
                  <span className="plaiz-plaiz-pill plaiz-pill-neutral">Not Configured</span>
                </div>
             </div>
          </section>

          {/* ACTIVITY */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold px-1">Activity</h3>
              <Link href="/activity" className="text-[11px] text-primary hover:underline font-medium px-1">View all</Link>
            </div>
            
            <div className="plaiz-card rounded-[20px] overflow-hidden">
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
              <Link key={sub.id} href="/accounts" className="group plaiz-card p-5 rounded-[16px] hover:border-border/80 transition-colors">
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
          <div className="plaiz-card p-8 rounded-[20px] flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 mb-3 text-muted-foreground opacity-50" />
            <p className="text-[13px] font-medium text-foreground">No Sub Accounts</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">Connect portfolio accounts to receive trades.</p>
            <ProtectedAction>
              <Link href="/accounts" className="plaiz-btn plaiz-btn-secondary">Add Account</Link>
            </ProtectedAction>
          </div>
        )}
      </section>

    </div>
  );
}
