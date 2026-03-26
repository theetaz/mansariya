// Location tracking service using expo-location
// Supports foreground and background GPS collection.

import * as Location from 'expo-location';
import {sendGPSBatch, GPSPing} from './api';

let isTracking = false;
let sessionId: string | null = null;
let deviceHash: string | null = null;
let pingBuffer: GPSPing[] = [];
let uploadInterval: ReturnType<typeof setInterval> | null = null;
let locationSubscription: Location.LocationSubscription | null = null;

function generateDeviceHash(): string {
  const chars = 'abcdef0123456789';
  let hash = '';
  for (let i = 0; i < 16; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function requestLocationPermissions(): Promise<boolean> {
  const {status: foreground} =
    await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    console.warn('[Location] Foreground permission denied');
    return false;
  }

  // Request background for tracking with screen off
  const {status: background} =
    await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') {
    console.log('[Location] Background permission denied — foreground only');
  }

  return true;
}

export async function startTracking() {
  if (isTracking) return;

  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;

  isTracking = true;
  deviceHash = generateDeviceHash();
  sessionId = generateSessionId();
  pingBuffer = [];

  // Start watching position
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20, // minimum 20m between updates
      timeInterval: 5000, // 5 second intervals
    },
    (location) => {
      if (!isTracking) return;

      const ping: GPSPing = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        ts: Math.floor(location.timestamp / 1000),
        acc: location.coords.accuracy ?? 10,
        spd: location.coords.speed ?? 0,
        brg: location.coords.heading ?? 0,
      };

      pingBuffer.push(ping);
      console.log(
        `[GPS] ${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)} acc=${ping.acc.toFixed(0)}m`,
      );
    },
  );

  // Batch upload every 10 seconds
  uploadInterval = setInterval(flushBuffer, 10000);

  console.log('[Tracking] Started', {
    deviceHash: deviceHash.slice(0, 8),
    sessionId,
  });
}

export function stopTracking() {
  if (!isTracking) return;

  isTracking = false;

  // Stop location watching
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  // Flush remaining pings
  flushBuffer();

  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }

  console.log('[Tracking] Stopped');
}

export function addPing(ping: GPSPing) {
  if (!isTracking) return;
  pingBuffer.push(ping);
}

async function flushBuffer() {
  if (pingBuffer.length === 0 || !deviceHash || !sessionId) return;

  const pings = [...pingBuffer];
  pingBuffer = [];

  try {
    await sendGPSBatch(deviceHash, sessionId, pings);
    console.log(`[Tracking] Uploaded ${pings.length} pings`);
  } catch (error) {
    // Re-add failed pings to buffer for retry
    pingBuffer = [...pings, ...pingBuffer];
    console.warn('[Tracking] Upload failed, will retry', error);
  }
}

export function isTrackingActive(): boolean {
  return isTracking;
}
