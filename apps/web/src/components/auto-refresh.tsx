'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let evtSource: EventSource | null = null;
    let isActive = true;
    let reconnectTimeout: NodeJS.Timeout;
    
    async function connect() {
      try {
        const res = await fetch('/api/realtime/ticket', { method: 'POST' });
        if (!res.ok || !isActive) return;
        const { ticket } = await res.json();
        if (!ticket) return;
        
        let apiUrl = 'https://plaiz-markets-api.onrender.com';
        evtSource = new EventSource(`${apiUrl}/realtime/stream?ticket=${ticket}`);
        
        evtSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'REFRESH') {
              // Emit instant event for client components
              if (data.payloads && Array.isArray(data.payloads)) {
                data.payloads.forEach((payload: any) => {
                  window.dispatchEvent(new CustomEvent('realtime-refresh', { detail: payload }));
                });
              } else if (data.payload) {
                window.dispatchEvent(new CustomEvent('realtime-refresh', { detail: data.payload }));
              }
              // Still do background refresh to sync DB state
              router.refresh();
            }
          } catch (e) {
            console.error('Failed to parse SSE event', e);
          }
        };

        evtSource.onerror = (err) => {
          console.error('SSE Error, closing connection', err);
          evtSource?.close();
          if (isActive) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

      } catch (err) {
        console.error('SSE connect error', err);
        if (isActive) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }
    
    connect();
    
    return () => {
      isActive = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (evtSource) evtSource.close();
    };
  }, [router]);

  return null;
}
