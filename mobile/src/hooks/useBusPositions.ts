import {useEffect} from 'react';
import {wsManager} from '../services/websocket';
import {useMapStore} from '../stores/useMapStore';
import {BusPosition} from '../services/api';

/**
 * Subscribe to real-time bus positions for a route via WebSocket.
 * Updates the map store automatically.
 */
export function useBusPositions(routeId: string | null) {
  const updateBus = useMapStore((s) => s.updateBus);

  useEffect(() => {
    if (!routeId) return;

    wsManager.connect(routeId, (data: BusPosition) => {
      updateBus(data);
    });

    return () => {
      wsManager.disconnect();
    };
  }, [routeId, updateBus]);
}
