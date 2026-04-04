import {useState, useEffect} from 'react';
import * as Location from 'expo-location';
import {DEFAULT_CENTER} from '../constants/map';

interface UserLocation {
  lat: number;
  lng: number;
  loading: boolean;
}

/**
 * Get the user's current GPS location on mount.
 * Falls back to DEFAULT_CENTER (Colombo) if permission denied or error.
 */
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>({
    lat: DEFAULT_CENTER[1],
    lng: DEFAULT_CENTER[0],
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const {status} = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) setLocation((prev) => ({...prev, loading: false}));
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (mounted) {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            loading: false,
          });
        }
      } catch {
        if (mounted) setLocation((prev) => ({...prev, loading: false}));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return location;
}
