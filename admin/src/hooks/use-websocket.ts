import { useEffect, useRef, useState, useCallback } from 'react';
import type { Vehicle } from '@/lib/types';

interface UseWebSocketOptions {
  enabled?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  vehicles: Vehicle[];
  lastMessage: Vehicle | null;
  isConnected: boolean;
  reconnectAttempts: number;
}

export function useWebSocket(
  routeId: string | null,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    enabled = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastMessage, setLastMessage] = useState<Vehicle | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!routeId || !enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/track/${routeId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setReconnectAttempts(0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Vehicle;
        setLastMessage(data);
        setVehicles((prev) => {
          const idx = prev.findIndex((v) => v.virtual_id === data.virtual_id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data;
            return next;
          }
          return [...prev, data];
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      setReconnectAttempts((prev) => {
        if (prev < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.min(prev + 1, 5);
          reconnectTimerRef.current = setTimeout(connect, delay);
          return prev + 1;
        }
        return prev;
      });
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [routeId, enabled, reconnectDelay, maxReconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setVehicles([]);
      setLastMessage(null);
      setIsConnected(false);
      setReconnectAttempts(0);
    };
  }, [connect]);

  return { vehicles, lastMessage, isConnected, reconnectAttempts };
}
