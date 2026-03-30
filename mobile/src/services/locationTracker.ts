import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { sendGPSBatch } from './api';

let isTracking = false;
let sessionId = '';
let deviceHash = '';
let pingBuffer: any[] = [];
let uploadInterval: NodeJS.Timeout | null = null;
let locationSubscription: Location.LocationSubscription | null = null;

function generateHash(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function startTracking(): Promise<boolean> {
  if (isTracking) return true;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  deviceHash = generateHash();
  sessionId = generateHash();
  isTracking = true;
  pingBuffer = [];

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20,
      timeInterval: 5000,
    },
    (location) => {
      if (!isTracking) return;
      pingBuffer.push({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        ts: Math.floor(location.timestamp / 1000),
        acc: location.coords.accuracy ?? 10,
        spd: location.coords.speed ?? 0,
        brg: location.coords.heading ?? 0,
      });
    },
  );

  uploadInterval = setInterval(flushBuffer, 10000);
  return true;
}

export function stopTracking() {
  isTracking = false;
  locationSubscription?.remove();
  locationSubscription = null;
  if (uploadInterval) clearInterval(uploadInterval);
  uploadInterval = null;
  flushBuffer();
}

export function isTrackingActive(): boolean {
  return isTracking;
}

async function flushBuffer() {
  if (pingBuffer.length === 0) return;
  const pings = [...pingBuffer];
  pingBuffer = [];
  try {
    await sendGPSBatch(deviceHash, sessionId, pings);
  } catch {
    pingBuffer.unshift(...pings);
  }
}

export { flushBuffer };
