'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useRealtime() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isComponentMounted = true;

    const connect = async () => {
      if (isConnectingRef.current || !isComponentMounted) return;
      isConnectingRef.current = true;

      try {
        // 1. Request short-lived single-use ticket via Next.js API proxy
        const ticketRes = await fetch('/api/realtime/ticket', {
          method: 'POST',
        });

        if (!ticketRes.ok) {
          throw new Error(`Failed to get SSE ticket: ${ticketRes.status}`);
        }

        const { ticket } = await ticketRes.json();
        if (!ticket || !isComponentMounted) {
          isConnectingRef.current = false;
          return;
        }

        // 2. Connect EventSource using the single-use ticket
        const apiUrl = 'https://plaiz-markets-api.onrender.com';
        eventSource = new EventSource(`${apiUrl}/realtime/stream?ticket=${ticket}`);

        eventSource.onopen = () => {
          if (isComponentMounted) {
            setIsConnected(true);
            isConnectingRef.current = false;
          }
        };

        eventSource.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(event.data);
            
            // Handle keepalive ping
            if (data.type === 'PING' || data.type === 'CONNECTED') {
              setIsConnected(true);
              return;
            }

            if (data.type === 'REFRESH') {
              setIsConnected(true);
              let shouldRefresh = false;

              // Emit instant event for client components (MoneyDisplay, MultiMoneyDisplay)
              if (data.payloads && Array.isArray(data.payloads)) {
                data.payloads.forEach((payload: any) => {
                  window.dispatchEvent(new CustomEvent('realtime-refresh', { detail: payload }));
                  if (!payload || payload.type !== 'TELEMETRY') {
                    shouldRefresh = true;
                  }
                });
              } else if (data.payload) {
                window.dispatchEvent(new CustomEvent('realtime-refresh', { detail: data.payload }));
                if (!data.payload || data.payload.type !== 'TELEMETRY') {
                  shouldRefresh = true;
                }
              } else {
                shouldRefresh = true;
              }

              if (shouldRefresh) {
                router.refresh();
              }
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        };

        eventSource.onerror = () => {
          if (!isComponentMounted) return;
          setIsConnected(false);
          isConnectingRef.current = false;
          eventSource?.close();

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMounted) connect();
          }, 3500);
        };

      } catch (err) {
        if (isComponentMounted) {
          setIsConnected(false);
          isConnectingRef.current = false;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMounted) connect();
          }, 5000);
        }
      }
    };

    connect();

    // Reconnect immediately when browser tab regains focus or comes back online
    const handleOnline = () => {
      if (!isConnected && !isConnectingRef.current) {
        connect();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      isComponentMounted = false;
      isConnectingRef.current = false;
      window.removeEventListener('online', handleOnline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [router]);

  return { isConnected };
}
