import React from 'react';

export function GenericLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-12 flex flex-col gap-8 pb-32">
      {/* Header Skeleton */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="h-8 w-64 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg mb-2"></div>
          <div className="h-4 w-48 bg-black/5 dark:bg-white/5 animate-pulse rounded-lg"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-9 bg-black/5 dark:bg-white/5 animate-pulse rounded-full"></div>
        </div>
      </header>

      {/* Content Skeleton */}
      <div className="flex-1 min-h-[500px] w-full bg-card border border-border/50 rounded-[24px] p-8 animate-pulse"></div>
    </div>
  );
}
