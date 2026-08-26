import { ShieldCheck, Wifi, ArrowRightLeft, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { MoneyDisplay } from '@/components/money-display';
import { MasterActions } from '@/components/master/master-actions';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterPage() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    redirect('/login');
  }

  const masterAccount = await prisma.mt5Account.findFirst({
    where: { role: 'MASTER', userId: user.id }
  });

  // Query signals for this specific master account
  const recentSignals = masterAccount ? await prisma.tradeSignal.findMany({
    where: { masterAcctId: masterAccount.id },
    take: 10,
    orderBy: { createdAt: 'desc' }
  }) : [];

  // Consider online only if isActive AND telemetry arrived within the last 30 seconds
  // (EA sends heartbeats every 5s, so 30s gives tolerance for network hiccups)
  const lastSeen = masterAccount?.updatedAt ? new Date(masterAccount.updatedAt).getTime() : 0;
  const masterOnline = (masterAccount?.isActive ?? false) && (Date.now() - lastSeen < 30_000);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      <header className="relative z-[60] flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Master Source
          </h1>
          <p className="text-muted-foreground text-[13px] tracking-wide mt-2">
            The source account driving all portfolio executions.
          </p>
        </div>
        <MasterActions masterAccountId={masterAccount?.id} />
      </header>

      <div className="relative z-10 flex flex-col gap-10">
        {masterAccount ? (
          <>
            <section className="plaiz-card p-8 rounded-[24px]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="plaiz-pill plaiz-pill-neutral text-[10px] uppercase tracking-widest">{masterAccount.broker || 'Unknown'}</div>
                    <div className={`plaiz-pill text-[10px] ${masterOnline ? 'plaiz-pill-success' : 'plaiz-pill-destructive'}`}><Wifi className="w-3 h-3" /> {masterOnline ? 'Connected' : 'Offline'}</div>
                  </div>
                  <h2 className="text-[36px] font-bold text-foreground tracking-tighter leading-none">{masterAccount.login}</h2>
                  <span className="text-[13px] text-muted-foreground font-mono">{masterAccount.server}</span>
                </div>
                
                <div className="flex flex-col gap-4 min-w-[200px]">
                  <div className="bg-card/50 px-5 py-4 rounded-xl border border-border/30 text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-[24px] font-semibold text-foreground num-tabular leading-none">
                      {masterAccount.balance != null ? <MoneyDisplay amount={masterAccount.balance} sourceCurrency={masterAccount.currency || 'USD'} /> : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-border/20">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Equity</span>
                  <span className="text-[16px] font-semibold text-foreground num-tabular">
                    {/* @ts-ignore - equity might not exist on all schema versions, fallback to balance */}
                    {masterAccount.equity != null ? <MoneyDisplay amount={masterAccount.equity} sourceCurrency={masterAccount.currency || 'USD'} /> : <MoneyDisplay amount={masterAccount.balance || 0} sourceCurrency={masterAccount.currency || 'USD'} />}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Floating P/L</span>
                  <span className={`text-[16px] font-semibold num-tabular ${(masterAccount.floatingPl || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    {(masterAccount.floatingPl || 0) >= 0 ? '+' : ''}<MoneyDisplay amount={masterAccount.floatingPl || 0} sourceCurrency={masterAccount.currency || 'USD'} />
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Status</span>
                  <span className="text-[16px] font-semibold text-foreground">{masterAccount.isDemo ? 'Demo' : 'Live'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1">Currency</span>
                  <span className="text-[16px] font-semibold text-foreground num-tabular">{masterAccount.currency || 'USD'}</span>
                </div>
              </div>
            </section>

            <section className="plaiz-card bg-secondary/30 rounded-[24px] overflow-hidden">
              <div className="p-6 border-b border-border/30">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Recent Signals</h3>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/30 bg-black/5 dark:bg-white/5">
                      <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">Symbol</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">Type</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold text-right">Volume</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold text-right">Price</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {recentSignals.length > 0 ? (
                      recentSignals.map((signal) => (
                        <tr key={signal.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-[13px] font-semibold text-foreground">
                            {signal.symbol}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`plaiz-pill text-[10px] ${signal.type === 'BUY' ? 'plaiz-pill-success' : 'plaiz-pill-destructive'}`}>
                              {signal.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[13px] font-mono text-foreground text-right">
                            {signal.volume}
                          </td>
                          <td className="px-6 py-4 text-[13px] font-mono text-muted-foreground text-right">
                            {signal.priceOpen}
                          </td>
                          <td className="px-6 py-4 text-[13px] text-muted-foreground text-right">
                            {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          <ArrowRightLeft className="w-8 h-8 mx-auto mb-3 opacity-30" />
                          <p className="text-[13px]">No recent signals found.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="plaiz-card bg-secondary/30 p-12 rounded-[24px] flex flex-col items-center justify-center text-center">
            <ShieldCheck className="w-10 h-10 mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-[16px] font-bold text-foreground mb-2">No Master Source Connected</h2>
            <p className="text-[13px] text-muted-foreground max-w-md">Connect an MT5 account and assign it the Master role to start broadcasting trades to your portfolio.</p>
          </div>
        )}
      </div>
    </div>
  );
}
