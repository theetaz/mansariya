import {useEffect, useRef, useCallback} from 'react';
import {useMapStore} from '../stores/useMapStore';
import {BusPosition} from '../services/api';
import {WS_BASE_URL, ENDPOINTS} from '../constants/api';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_MS = 3000;

/**
 * Subscribe to ALL active routes via WebSocket and aggregate bus positions.
 * Uses exponential backoff with max attempts to avoid log spam.
 */
export function useLiveBuses(routeIds: string[]) {
  const updateBus = useMapStore((s) => s.updateBus);
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());
  const attemptsRef = useRef<Map<string, number>>(new Map());

  const connectRoute = useCallback(
    (routeId: string) => {
      const existing = wsRefs.current.get(routeId);
      if (existing && existing.readyState === WebSocket.OPEN) return;

      const attempts = attemptsRef.current.get(routeId) ?? 0;
      if (attempts >= MAX_RECONNECT_ATTEMPTS) return;

      const url = `${WS_BASE_URL}${ENDPOINTS.WS_TRACK(routeId)}`;

      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          attemptsRef.current.set(routeId, 0); // reset on success
          if (__DEV__) console.log(`[WS] Connected: route ${routeId}`);
        };

        ws.onmessage = (event) => {
          try {
            const bus: BusPosition = JSON.parse(event.data);
            updateBus(bus);
          } catch {
            // silently ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRefs.current.delete(routeId);
          const nextAttempt = (attemptsRef.current.get(routeId) ?? 0) + 1;
          attemptsRef.current.set(routeId, nextAttempt);

          if (nextAttempt < MAX_RECONNECT_ATTEMPTS && routeIds.includes(routeId)) {
            const delay = RECONNECT_BASE_MS * Math.pow(2, nextAttempt - 1); // 3s, 6s, 12s, 24s, 48s
            setTimeout(() => connectRoute(routeId), delay);
          }
        };

        ws.onerror = () => {
          // onclose will fire after this
        };

        wsRefs.current.set(routeId, ws);
      } catch {
        // WebSocket constructor can throw if URL is invalid
      }
    },
    [routeIds, updateBus],
  );

  useEffect(() => {
    // Reset attempts when route list changes
    attemptsRef.current.clear();
    routeIds.forEach(connectRoute);

    return () => {
      wsRefs.current.forEach((ws) => {
        ws.onclose = null;
        ws.close();
      });
      wsRefs.current.clear();
      attemptsRef.current.clear();
    };
  }, [routeIds.join(','), connectRoute]);
}
