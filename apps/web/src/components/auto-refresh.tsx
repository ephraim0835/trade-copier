'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let evtSource: EventSource | null = null;
    let isActive = true;
    
    async function connect() {
      try {
        const res = await fetch('/api/realtime/ticket', { method: 'POST' });
        if (!res.ok || !isActive) return;
        const { ticket } = await res.json();
        if (!ticket) return;
        
        let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://plaiz-markets-api.onrender.com';
        evtSource = new EventSource(`${apiUrl}/realtime/stream?ticket=${ticket}`);
        
        evtSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'REFRESH') {
              router.refresh();
            }
          } catch (e) {
            console.error('Failed to parse SSE event', e);
          }
        };

        evtSource.onerror = (err) => {
          console.error('SSE Error, closing connection', err);
          evtSource?.close();
        };

      } catch (err) {
        console.error('SSE connect error', err);
      }
    }
    
    connect();
    
    return () => {
      isActive = false;
      if (evtSource) evtSource.close();
    };
  }, [router]);

  return null;
}
