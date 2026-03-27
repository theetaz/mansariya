import {useState, useEffect} from 'react';
import {fetchRouteStops, EnrichedRouteStop} from '../services/api';
import {API_BASE_URL} from '../constants/api';

/**
 * Fetches route polyline (road-snapped) and stops for rendering on the map.
 * The polyline comes from the backend's stored OSRM-routed geometry,
 * not from connecting stop coordinates with straight lines.
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

    // Fetch both stops and the actual road-snapped polyline
    Promise.all([
      fetchRouteStops(routeId),
      fetch(`${API_BASE_URL}/api/v1/routes/${routeId}/polyline`)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([stopsData, polylineData]) => {
        setStops(stopsData || []);

        // Use the road-snapped polyline from the backend
        if (polylineData?.coordinates?.length >= 2) {
          setPolylineCoords(polylineData.coordinates);
        } else {
          // Fallback: connect stops with straight lines
          const coords: [number, number][] = (stopsData || []).map(
            (s: EnrichedRouteStop) => [s.stop_lng, s.stop_lat],
          );
          setPolylineCoords(coords);
        }
      })
      .catch(() => {
        setStops([]);
        setPolylineCoords([]);
      })
      .finally(() => setLoading(false));
  }, [routeId]);

  return {stops, polylineCoords, loading};
}
