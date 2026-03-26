import {useState, useEffect} from 'react';
import {API_BASE_URL} from '../constants/api';

/**
 * Fetch active routes from the backend that have live bus data.
 * Polls every 30 seconds to discover new routes being tracked.
 */
export function useActiveRoutes() {
  const [routeIds, setRouteIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        // Try to get routes near Colombo (default location)
        const resp = await fetch(
          `${API_BASE_URL}/api/v1/routes?lat=6.9271&lng=79.8612&radius_km=50`,
        );
        if (resp.ok) {
          const routes = await resp.json();
          if (Array.isArray(routes)) {
            const ids = routes.map((r: any) => r.id);
            setRouteIds(ids);
          }
        }
      } catch {
        // Use known routes as fallback
        setRouteIds(['1', '2', '4', '100', '103', '120', '138']);
      }
    };

    fetchRoutes();
    const interval = setInterval(fetchRoutes, 30000);
    return () => clearInterval(interval);
  }, []);

  return routeIds;
}
