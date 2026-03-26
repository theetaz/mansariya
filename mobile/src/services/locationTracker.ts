// Location tracking service
// Uses react-native-geolocation-service for foreground GPS collection.
// Production will add react-native-background-geolocation for background mode.

import Geolocation from 'react-native-geolocation-service';
import {Platform} from 'react-native';
import {sendGPSBatch, GPSPing} from './api';

let isTracking = false;
let sessionId: string | null = null;
let deviceHash: string | null = null;
let pingBuffer: GPSPing[] = [];
let uploadInterval: ReturnType<typeof setInterval> | null = null;
let watchId: number | null = null;

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

export function startTracking() {
  if (isTracking) return;

  isTracking = true;
  deviceHash = generateDeviceHash();
  sessionId = generateSessionId();
  pingBuffer = [];

  // Start GPS watching
  watchId = Geolocation.watchPosition(
    (position) => {
      if (!isTracking) return;

      const ping: GPSPing = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        ts: Math.floor(position.timestamp / 1000),
        acc: position.coords.accuracy ?? 10,
        spd: position.coords.speed ?? 0,
        brg: position.coords.heading ?? 0,
      };

      pingBuffer.push(ping);
      console.log(
        `[GPS] ${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)} acc=${ping.acc.toFixed(0)}m`,
      );
    },
    (error) => {
      console.warn('[GPS] Error:', error.code, error.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 20, // minimum 20m between updates
      interval: 5000, // 5 second intervals (Android)
      fastestInterval: 3000,
      ...(Platform.OS === 'ios' ? {showsBackgroundLocationIndicator: true} : {}),
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

  // Stop GPS watching
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
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
