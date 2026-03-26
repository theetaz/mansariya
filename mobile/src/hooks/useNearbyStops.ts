import {useState, useCallback} from 'react';
import {fetchNearbyStops, Stop} from '../services/api';

/**
 * Fetch stops near a given location.
 */
export function useNearbyStops() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNearby = useCallback(async (lat: number, lng: number, radiusKm = 1) => {
    setLoading(true);
    try {
      const data = await fetchNearbyStops(lat, lng, radiusKm);
      setStops(data);
    } catch {
      setStops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {stops, loading, fetchNearby};
}
