import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendGPSBatch } from './api';

const BACKGROUND_LOCATION_TASK = 'mansariya-background-location';

// Module-level state — persists across foreground/background
let sessionId = '';
let deviceHash = '';
let pingBuffer: any[] = [];
let tripMeta: { route_id?: string; bus_number?: string; crowd_level?: number } = {};
let lastFlushTime = 0;
const FLUSH_INTERVAL_MS = 10000; // flush every 10 seconds

function generateHash(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Background task — receives location updates even when screen is locked / app backgrounded.
// Buffers pings and flushes to server every 10 seconds.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[Location] Background task error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    for (const location of locations) {
      pingBuffer.push({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        ts: Math.floor(location.timestamp / 1000),
        acc: location.coords.accuracy ?? 10,
        spd: location.coords.speed ?? 0,
        brg: location.coords.heading ?? 0,
      });
    }

    // Flush to server if enough time has passed
    const now = Date.now();
    if (now - lastFlushTime >= FLUSH_INTERVAL_MS && pingBuffer.length > 0) {
      lastFlushTime = now;
      await flushBuffer();
    }
  }
});

export async function startTracking(meta?: {
  routeId?: string | null;
  busNumber?: string | null;
  crowdLevel?: number | null;
}): Promise<boolean> {
  if (await isTrackingActive()) return true;

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[Location] Background permission denied');
  }

  deviceHash = generateHash();
  sessionId = generateHash();
  pingBuffer = [];
  lastFlushTime = Date.now();
  tripMeta = {};
  if (meta?.routeId) tripMeta.route_id = meta.routeId;
  if (meta?.busNumber) tripMeta.bus_number = meta.busNumber;
  if (meta?.crowdLevel) tripMeta.crowd_level = meta.crowdLevel;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Mansariya',
      notificationBody: 'Sharing your location to help track buses',
      notificationColor: '#1D9E75',
    },
    // iOS: pause updates automatically when no movement detected
    pausesUpdatesAutomatically: false,
    // iOS: activity type hint for better background performance
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  return true;
}

export async function stopTracking() {
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  // Final flush
  await flushBuffer();
  tripMeta = {};
  pingBuffer = [];
  sessionId = '';
  deviceHash = '';
}

export async function isTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}

async function flushBuffer() {
  if (pingBuffer.length === 0 || !sessionId || !deviceHash) return;
  const pings = [...pingBuffer];
  pingBuffer = [];
  try {
    await sendGPSBatch(deviceHash, sessionId, pings, tripMeta);
  } catch {
    // Re-buffer on failure
    pingBuffer.unshift(...pings);
  }
}

export { flushBuffer };
