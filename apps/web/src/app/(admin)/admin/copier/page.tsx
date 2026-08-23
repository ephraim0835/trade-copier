import { ShieldAlert, Activity, ArrowRightLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export default async function CopierAdminPage() {
  let recentTrades: any[] = [];
  try {
    recentTrades = await prisma.tradeCopy.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        signal: true,
        subAccount: true
      }
    });
  } catch (e) {
    console.error("Failed to fetch recent trades", e);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Copier Operations</h1>
        <p className="text-muted-foreground">Monitor real-time trade routing, latency, and system execution across all connected MT5 instances.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="plaiz-card p-6 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-primary mb-3" />
          <span className="text-3xl font-bold num-tabular">14ms</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Avg Latency (1H)</span>
        </div>
        <div className="plaiz-card p-6 flex flex-col items-center justify-center text-center">
          <ArrowRightLeft className="w-8 h-8 text-emerald-500 mb-3" />
          <span className="text-3xl font-bold num-tabular">99.9%</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Execution Success</span>
        </div>
        <div className="plaiz-card p-6 flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-8 h-8 text-destructive mb-3" />
          <span className="text-3xl font-bold num-tabular">0</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Risk Interventions</span>
        </div>
      </div>

      <div className="plaiz-card rounded-[20px] overflow-hidden">
        <div className="p-6 border-b border-border/40">
           <h3 className="font-bold">Recent Trade Routing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-semibold">Signal ID</th>
                <th className="px-6 py-4 font-semibold">Symbol</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Target Account</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <ArrowRightLeft className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No trades have been routed yet.</p>
                  </td>
                </tr>
              ) : (
                recentTrades.map((trade: any) => {
                  let latencyMs = 0;
                  if (trade.masterEventSentAt && trade.subExecutionCompletedAt) {
                    latencyMs = new Date(trade.subExecutionCompletedAt).getTime() - new Date(trade.masterEventSentAt).getTime();
                  }

                  return (
                    <tr key={trade.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {trade.signalId.slice(0,8)}...
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {trade.signal?.symbol || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${trade.signal?.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                          {trade.signal?.type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {trade.subAccount?.login || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`plaiz-pill text-[10px] ${
                          trade.state === 'EXECUTED' ? 'plaiz-pill-success' :
                          trade.state === 'FAILED' ? 'plaiz-pill-destructive' :
                          'plaiz-pill-neutral'
                        }`}>
                          {trade.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium num-tabular">
                        {latencyMs > 0 ? `${latencyMs}ms` : 'N/A'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
