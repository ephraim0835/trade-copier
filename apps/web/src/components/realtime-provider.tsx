'use client';

import { useRealtime } from '@/hooks/use-realtime';
import { useEffect, useState } from 'react';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useRealtime();
  const [showReconnecting, setShowReconnecting] = useState(false);

  useEffect(() => {
    // Grace period: do not show reconnection indicator on initial page mount or brief reconnects
    if (isConnected) {
      setShowReconnecting(false);
      return;
    }

    // Only show after remaining disconnected for more than 4 seconds
    const timer = setTimeout(() => {
      if (!isConnected) {
        setShowReconnecting(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isConnected]);

  return (
    <>
      {showReconnecting && (
        <div className="fixed bottom-24 lg:bottom-4 right-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 z-[60] backdrop-blur-md shadow-lg transition-all animate-in fade-in duration-300">
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
