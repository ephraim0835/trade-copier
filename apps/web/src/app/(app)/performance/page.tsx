import { LineChart, Info } from 'lucide-react';
import Link from 'next/link';

export default function PerformancePage() {
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
        <section className="plaiz-card p-8 md:p-16 rounded-[32px] flex-1 flex flex-col items-center justify-center text-center min-h-[500px]">
          <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 border border-border/20 flex items-center justify-center mb-6 shadow-sm">
            <LineChart className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          
          <h2 className="text-[20px] font-bold text-foreground mb-3">Not enough data yet</h2>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
            Performance analytics require historical trade data to generate accurate growth curves and drawdown metrics. Once your portfolio begins executing trades, this dashboard will automatically populate.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/" className="plaiz-btn plaiz-plaiz-btn-secondary">
              Return to Dashboard
            </Link>
            <Link href="/accounts" className="plaiz-btn plaiz-plaiz-btn-primary">
              Connect Accounts
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
