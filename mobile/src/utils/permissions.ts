import * as Location from 'expo-location';
import { Alert } from 'react-native';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Location Permission',
      'Location access is needed to track bus positions. Please enable it in settings.',
    );
    return false;
  }
  return true;
}

export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Background Location',
      'Background location is needed to track while the app is minimized.',
    );
    return false;
  }
  return true;
}
