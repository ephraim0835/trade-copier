import { Activity, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function ActivityPage() {
  const recentActivity = await prisma.tradeCopy.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      signal: true,
      subAccount: true
    }
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32 overflow-y-auto custom-scrollbar relative">
      <header className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Activity Log
          </h1>
          <p className="text-muted-foreground text-[13px] tracking-wide mt-2">
            Detailed log of all copy execution events across the portfolio.
          </p>
        </div>
      </header>

      <div className="relative z-10">
        <section className="plaiz-card bg-secondary/30 rounded-[24px] overflow-hidden">
          {recentActivity.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/30 bg-black/5 dark:bg-white/5">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">Action</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold text-right">Volume</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">Destination</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.state === 'EXECUTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                          {activity.signal?.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-foreground leading-tight">
                            {activity.signal?.type === 'BUY' ? 'Buy' : 'Sell'} {activity.signal?.symbol}
                          </span>
                          <span className={`text-[11px] mt-0.5 ${activity.state === 'EXECUTED' ? 'text-emerald-500' : 'text-destructive'}`}>
                            {activity.state}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-mono text-foreground text-right">
                        {activity.signal?.volume}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground">{activity.subAccount?.login}</span>
                          <span className="plaiz-plaiz-pill plaiz-pill-neutral text-[9px] uppercase">{activity.subAccount?.broker || 'MT5'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-muted-foreground text-right">
                        {new Date(activity.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Clock className="w-10 h-10 mb-4 opacity-30" />
              <h2 className="text-[16px] font-bold text-foreground mb-2">No Recent Activity</h2>
              <p className="text-[13px] max-w-sm mx-auto">
                No trades have been copied recently. Make sure your Master Account is connected and sending signals.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
