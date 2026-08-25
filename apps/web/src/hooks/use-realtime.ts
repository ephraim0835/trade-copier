'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useRealtime() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isComponentMounted = true;

    const connect = async () => {
      try {
        // 1. Request short-lived single-use ticket via Next.js API proxy
        // The Next.js API route will attach the NextAuth server-side JWT automatically.
        const ticketRes = await fetch('/api/realtime/ticket', {
          method: 'POST',
        });

        if (!ticketRes.ok) {
          throw new Error('Failed to get SSE ticket');
        }

        const { ticket } = await ticketRes.json();

        // 2. Connect EventSource using the single-use ticket
        if (!isComponentMounted) return;

        eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/realtime/stream?ticket=${ticket}`);

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'REFRESH') {
            // Trigger Next.js Server Components to re-fetch the latest Prisma state
            router.refresh();
          }
        };

        eventSource.onerror = () => {
          // Native EventSource tries to auto-reconnect using the SAME url.
          // Since our ticket is single-use and consumed, the reconnect will get a 401.
          // We MUST close it and fetch a new ticket manually.
          setIsConnected(false);
          eventSource?.close();
          
          if (isComponentMounted) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

      } catch (err) {
        console.error('Realtime connection error:', err);
        setIsConnected(false);
        if (isComponentMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [router]);

  return { isConnected };
}
