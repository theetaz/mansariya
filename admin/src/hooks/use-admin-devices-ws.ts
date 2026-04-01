import { useEffect, useRef, useState, useCallback } from 'react';
import type { DeviceInfo, DeviceCounts, DevicesUpdate } from '@/lib/types';

interface UseAdminDevicesWSReturn {
  devices: DeviceInfo[];
  counts: DeviceCounts;
  isConnected: boolean;
}

const emptyCounts: DeviceCounts = {
  total: 0,
  noise: 0,
  potential: 0,
  cluster: 0,
  confirmed: 0,
  active: 0,
  suspect: 0,
  disconnected: 0,
};

export function useAdminDevicesWS(enabled = true): UseAdminDevicesWSReturn {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [counts, setCounts] = useState<DeviceCounts>(emptyCounts);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    const wsBaseUrl = resolveDevicesWebSocketBaseUrl();
    const apiKey = import.meta.env.VITE_API_KEY ?? '';
    const url = `${wsBaseUrl}/ws/admin/devices?api_key=${encodeURIComponent(apiKey)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DevicesUpdate;
        if (data.type === 'devices_update') {
          setDevices(data.devices);
          setCounts(data.counts);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (reconnectAttempts.current < 10) {
        const delay = 3000 * Math.min(reconnectAttempts.current + 1, 5);
        reconnectTimerRef.current = setTimeout(connect, delay);
        reconnectAttempts.current++;
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setDevices([]);
      setCounts(emptyCounts);
      setIsConnected(false);
      reconnectAttempts.current = 0;
    };
  }, [connect]);

  return { devices, counts, isConnected };
}

function resolveDevicesWebSocketBaseUrl(): string {
  const explicitWsUrl = import.meta.env.VITE_WS_URL;
  if (explicitWsUrl) {
    return explicitWsUrl.replace(/\/$/, '');
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}
