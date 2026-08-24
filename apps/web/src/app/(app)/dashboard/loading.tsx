export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-10 pb-32">
      {/* Header Skeleton */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="h-8 w-64 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg mb-2"></div>
          <div className="h-4 w-48 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-9 bg-black/5 dark:bg-white/5 animate-pulse rounded-full"></div>
          <div className="w-24 h-9 bg-black/5 dark:bg-white/5 animate-pulse rounded-full"></div>
          <div className="w-9 h-9 bg-black/5 dark:bg-white/5 animate-pulse rounded-full"></div>
        </div>
      </header>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Vault Card Skeleton */}
        <section className="lg:col-span-2 relative">
          <div className="relative bg-card border border-border/50 rounded-[24px] p-8 lg:p-10 shadow-sm h-[280px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div>
              <div className="h-3 w-32 bg-black/5 dark:bg-white/5 animate-pulse rounded-sm"></div>
            </div>
            <div className="h-16 w-1/2 bg-black/5 dark:bg-white/5 animate-pulse rounded-xl mb-4"></div>
            <div className="h-6 w-32 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg"></div>
          </div>
        </section>

        {/* Quick Actions Skeleton */}
        <section className="flex flex-col gap-4">
          <div className="h-32 bg-card border border-border/50 rounded-2xl animate-pulse"></div>
          <div className="h-32 bg-card border border-border/50 rounded-2xl animate-pulse"></div>
        </section>
      </div>

      {/* Performance Chart Skeleton */}
      <section className="h-[400px] bg-card border border-border/50 rounded-[24px] p-8 animate-pulse"></section>
    </div>
  );
}
