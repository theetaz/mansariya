// Location tracking service
// Uses react-native-background-geolocation (install separately — requires license for production)
// This is the scaffold — actual BG geolocation integration requires native setup

import {sendGPSBatch, GPSPing} from './api';

let isTracking = false;
let sessionId: string | null = null;
let deviceHash: string | null = null;
let pingBuffer: GPSPing[] = [];
let uploadInterval: ReturnType<typeof setInterval> | null = null;

// Generate a random device hash (rotated daily in production)
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

  // Start batched upload every 10 seconds
  uploadInterval = setInterval(flushBuffer, 10000);

  console.log('[Tracking] Started', {deviceHash: deviceHash.slice(0, 8), sessionId});

  // TODO: Integrate react-native-background-geolocation here
  // BackgroundGeolocation.ready({...config}).then(() => BackgroundGeolocation.start())
  // For now, this is a placeholder. The actual GPS collection would push to pingBuffer.
}

export function stopTracking() {
  if (!isTracking) return;

  isTracking = false;

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
