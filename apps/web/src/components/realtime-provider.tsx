'use client';

import { useRealtime } from '@/hooks/use-realtime';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useRealtime();

  // We could display a global connection status indicator here if desired
  // For now, it just silently maintains the connection and triggers refreshes
  return (
    <>
      {!isConnected && (
        <div className="fixed bottom-24 lg:bottom-4 right-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 z-[60]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Reconnecting to real-time stream...
        </div>
      )}
      {children}
    </>
  );
}
