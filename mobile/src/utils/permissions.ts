import {Platform, PermissionsAndroid, Alert} from 'react-native';

/**
 * Request location permissions for Android.
 * Returns true if granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const fineLocation = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message:
          'Mansariya needs your location to track buses and show nearby routes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    if (fineLocation === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    }

    Alert.alert(
      'Permission Required',
      'Location access is needed to track buses. Please enable it in Settings.',
    );
    return false;
  } catch (err) {
    console.warn('Location permission error:', err);
    return false;
  }
}

/**
 * Request background location permission (Android 10+).
 * Should only be called after foreground permission is granted.
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 29) return true;

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Background Location',
        message:
          'Allow Mansariya to access your location in the background so we can track your bus even when the app is minimized.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Background location permission error:', err);
    return false;
  }
}
