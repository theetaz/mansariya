import {useState, useEffect} from 'react';
import {API_BASE_URL} from '../constants/api';
import {DEFAULT_CENTER} from '../constants/map';

/**
 * Fetch active routes from the backend that have live bus data.
 * Uses the user's actual location (or falls back to default).
 * Polls every 30 seconds to discover new routes being tracked.
 */
export function useActiveRoutes(lat?: number, lng?: number) {
  const [routeIds, setRouteIds] = useState<string[]>([]);

  const queryLat = lat ?? DEFAULT_CENTER[1];
  const queryLng = lng ?? DEFAULT_CENTER[0];

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/v1/routes?lat=${queryLat}&lng=${queryLng}&radius_km=50`,
        );
        if (resp.ok) {
          const routes = await resp.json();
          if (Array.isArray(routes)) {
            const ids = routes.map((r: any) => r.id);
            setRouteIds(ids);
          }
        }
      } catch {
        setRouteIds([]);
      }
    };

    fetchRoutes();
    const interval = setInterval(fetchRoutes, 30000);
    return () => clearInterval(interval);
  }, [queryLat, queryLng]);

  return routeIds;
}
