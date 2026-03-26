import * as Location from 'expo-location';
import {Alert} from 'react-native';

/**
 * Request foreground location permission.
 * Returns true if granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const {status} = await Location.requestForegroundPermissionsAsync();

  if (status === 'granted') {
    return true;
  }

  Alert.alert(
    'Permission Required',
    'Location access is needed to track buses. Please enable it in Settings.',
  );
  return false;
}

/**
 * Request background location permission.
 * Should only be called after foreground permission is granted.
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const {status} = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}
