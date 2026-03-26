import {useEffect, useRef, useCallback} from 'react';
import {useMapStore} from '../stores/useMapStore';
import {BusPosition} from '../services/api';
import {WS_BASE_URL, ENDPOINTS} from '../constants/api';

/**
 * Subscribe to ALL active routes via WebSocket and aggregate bus positions.
 * This is the main hook for the MapScreen — shows all nearby buses.
 */
export function useLiveBuses(routeIds: string[]) {
  const updateBus = useMapStore((s) => s.updateBus);
  const removeBus = useMapStore((s) => s.removeBus);
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  const connectRoute = useCallback(
    (routeId: string) => {
      const existing = wsRefs.current.get(routeId);
      if (existing && existing.readyState === WebSocket.OPEN) return;

      const url = `${WS_BASE_URL}${ENDPOINTS.WS_TRACK(routeId)}`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`[WS] Connected: route ${routeId}`);
      };

      ws.onmessage = (event) => {
        try {
          const bus: BusPosition = JSON.parse(event.data);
          updateBus(bus);
        } catch (e) {
          console.warn('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log(`[WS] Disconnected: route ${routeId}`);
        wsRefs.current.delete(routeId);
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (routeIds.includes(routeId)) {
            connectRoute(routeId);
          }
        }, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };

      wsRefs.current.set(routeId, ws);
    },
    [routeIds, updateBus],
  );

  useEffect(() => {
    // Connect to each route
    routeIds.forEach(connectRoute);

    return () => {
      // Disconnect all on unmount
      wsRefs.current.forEach((ws) => {
        ws.onclose = null;
        ws.close();
      });
      wsRefs.current.clear();
    };
  }, [routeIds.join(','), connectRoute]);
}
