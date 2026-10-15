export default function AdminRootLoading() {
  return (
    <div className="min-h-screen bg-background flex animate-in fade-in duration-200">
      {/* Admin Sidebar Skeleton */}
      <aside className="w-64 border-r border-border/40 bg-card/50 flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border/40 gap-3">
          <div className="w-6 h-6 rounded-md bg-black/5 dark:bg-white/5 animate-pulse"></div>
          <div className="h-4 w-28 bg-black/5 dark:bg-white/5 animate-pulse rounded"></div>
        </div>
        <div className="px-6 py-4 border-b border-border/40">
          <div className="h-4 w-32 bg-black/5 dark:bg-white/5 animate-pulse rounded"></div>
        </div>
        <div className="p-6 space-y-3">
          <div className="h-3 w-24 bg-black/5 dark:bg-white/5 animate-pulse rounded mb-4"></div>
          <div className="h-9 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
          <div className="h-9 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
          <div className="h-9 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
          <div className="h-9 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
          <div className="h-9 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
        </div>
      </aside>

      {/* Main Content Area Skeleton */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header Bar Skeleton */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-background/80">
          <div className="h-5 w-32 bg-black/5 dark:bg-white/5 animate-pulse rounded"></div>
          <div className="flex items-center gap-4">
            <div className="h-7 w-24 bg-black/5 dark:bg-white/5 animate-pulse rounded-full"></div>
            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div>
          </div>
        </header>

        {/* Content Body Skeleton */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-8">
          <div>
            <div className="h-8 w-60 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg mb-2"></div>
            <div className="h-4 w-96 max-w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-md"></div>
          </div>

          {/* 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="plaiz-card p-6 flex flex-col justify-between h-[150px]">
                <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 animate-pulse mb-4"></div>
                <div>
                  <div className="h-3 w-28 bg-black/5 dark:bg-white/5 animate-pulse rounded mb-2"></div>
                  <div className="h-7 w-20 bg-black/5 dark:bg-white/5 animate-pulse rounded-md"></div>
                </div>
              </div>
            ))}
          </div>

          {/* 2 Lower Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="plaiz-card p-6 flex flex-col h-[230px]">
              <div className="h-5 w-48 bg-black/5 dark:bg-white/5 animate-pulse rounded-md mb-6"></div>
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div>
                <div className="h-3 w-56 bg-black/5 dark:bg-white/5 animate-pulse rounded"></div>
              </div>
            </div>

            <div className="plaiz-card p-6 flex flex-col h-[230px]">
              <div className="h-5 w-36 bg-black/5 dark:bg-white/5 animate-pulse rounded-md mb-6"></div>
              <div className="flex flex-col gap-3">
                <div className="h-10 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
                <div className="h-10 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
