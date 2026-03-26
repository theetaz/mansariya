import {useState, useEffect} from 'react';
import {fetchRouteStops, EnrichedRouteStop} from '../services/api';

/**
 * Fetches route stops for rendering polyline and stop markers on the map.
 * Returns stop coordinates as [lng, lat] pairs for the polyline,
 * and enriched stops for markers.
 */
export function useRouteOnMap(routeId: string | null) {
  const [stops, setStops] = useState<EnrichedRouteStop[]>([]);
  const [polylineCoords, setPolylineCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeId) {
      setStops([]);
      setPolylineCoords([]);
      return;
    }

    setLoading(true);
    fetchRouteStops(routeId)
      .then((data) => {
        setStops(data);
        // Build polyline from stop coordinates
        const coords: [number, number][] = data.map((s) => [s.stop_lng, s.stop_lat]);
        setPolylineCoords(coords);
      })
      .catch(() => {
        setStops([]);
        setPolylineCoords([]);
      })
      .finally(() => setLoading(false));
  }, [routeId]);

  return {stops, polylineCoords, loading};
}
