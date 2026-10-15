export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Title & Subtitle Skeleton */}
      <div>
        <div className="h-8 w-60 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg mb-2"></div>
        <div className="h-4 w-96 max-w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-md"></div>
      </div>

      {/* 4 Overview Metrics Skeleton Cards */}
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

      {/* 2 Lower Panels Skeleton (Recent System Events & Quick Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Events Panel Skeleton */}
        <section className="plaiz-card p-6 flex flex-col h-[230px]">
          <div className="h-5 w-48 bg-black/5 dark:bg-white/5 animate-pulse rounded-md mb-6"></div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse"></div>
            <div className="h-3 w-56 bg-black/5 dark:bg-white/5 animate-pulse rounded"></div>
          </div>
        </section>

        {/* Quick Actions Panel Skeleton */}
        <section className="plaiz-card p-6 flex flex-col h-[230px]">
          <div className="h-5 w-36 bg-black/5 dark:bg-white/5 animate-pulse rounded-md mb-6"></div>
          <div className="flex flex-col gap-3">
            <div className="h-10 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
            <div className="h-10 w-full bg-black/5 dark:bg-white/5 animate-pulse rounded-xl"></div>
          </div>
        </section>
      </div>
    </div>
  );
}
