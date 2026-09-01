import { LineChart, Info, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PerformanceChart } from '@/components/dashboard/performance-chart';

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) redirect('/login');

  const snapshots = await prisma.accountSnapshot.findMany({
    where: { mt5Account: { userId: user.id } },
    orderBy: { timestamp: 'asc' },
  });

  // Group snapshots by Date (hourly aggregation)
  const groupedSnapshots = snapshots.reduce((acc: any, curr: any) => {
    const date = new Date(curr.timestamp);
    const hourKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:00`;
    
    if (!acc[hourKey]) {
      acc[hourKey] = {
        date: date.toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: date.getTime(),
        value: 0
      };
    }
    acc[hourKey].value += curr.equity || 0;
    return acc;
  }, {});

  const chartData: any[] = Object.values(groupedSnapshots).sort((a: any, b: any) => a.timestamp - b.timestamp);

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      <header className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LineChart className="w-6 h-6 text-primary" />
            Performance
          </h1>
          <p className="text-muted-foreground text-[13px] tracking-wide mt-2 max-w-xl">
            Historical portfolio analytics, drawdown metrics, and growth trajectories.
          </p>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col">
        {chartData.length > 0 ? (
          <section className="plaiz-card p-6 rounded-[24px] flex-1 flex flex-col min-h-[500px]">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Total Portfolio Equity</h3>
             </div>
             <div className="flex-1 -mx-4 -mb-4">
               <PerformanceChart data={chartData} />
             </div>
          </section>
        ) : (
          <section className="plaiz-card p-8 md:p-16 rounded-[32px] flex-1 flex flex-col items-center justify-center text-center min-h-[500px]">
            <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 border border-border/20 flex items-center justify-center mb-6 shadow-sm">
              <LineChart className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            
            <h2 className="text-[20px] font-bold text-foreground mb-3">Not enough data yet</h2>
            <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
              Performance analytics require historical trade data to generate accurate growth curves and drawdown metrics. Once your portfolio begins executing trades, this dashboard will automatically populate.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/" className="plaiz-btn plaiz-btn-secondary">
                Return to Dashboard
              </Link>
              <Link href="/accounts" className="plaiz-btn plaiz-btn-primary">
                Connect Accounts
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
