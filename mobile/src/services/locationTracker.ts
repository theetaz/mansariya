import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendGPSBatch } from './api';
import { useTrackingStore } from '../stores/useTrackingStore';

const BACKGROUND_LOCATION_TASK = 'mansariya-background-location';

// Module-level state
let sessionId = '';
let deviceHash = '';
let pingBuffer: any[] = [];
let uploadInterval: NodeJS.Timeout | null = null;
let tripMeta: { route_id?: string; bus_number?: string; crowd_level?: number } = {};

function generateHash(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Define background task — this runs even when the app is backgrounded/screen locked
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
  }
});

export async function startTracking(meta?: {
  routeId?: string | null;
  busNumber?: string | null;
  crowdLevel?: number | null;
}): Promise<boolean> {
  // Prevent double start
  if (await isTrackingActive()) return true;

  // Request foreground permission first
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  // Request background permission
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[Location] Background permission denied, using foreground only');
  }

  deviceHash = generateHash();
  sessionId = generateHash();
  pingBuffer = [];
  tripMeta = {};
  if (meta?.routeId) tripMeta.route_id = meta.routeId;
  if (meta?.busNumber) tripMeta.bus_number = meta.busNumber;
  if (meta?.crowdLevel) tripMeta.crowd_level = meta.crowdLevel;

  // Start background location updates
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 20,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Mansariya',
      notificationBody: 'Sharing your location to help track buses',
      notificationColor: '#1D9E75',
    },
  });

  // Periodic upload
  uploadInterval = setInterval(flushBuffer, 10000);
  return true;
}

export async function stopTracking() {
  // Stop background location
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  // Clear upload interval
  if (uploadInterval) clearInterval(uploadInterval);
  uploadInterval = null;

  // Flush remaining pings
  await flushBuffer();
  tripMeta = {};
  pingBuffer = [];
}

export async function isTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}

async function flushBuffer() {
  if (pingBuffer.length === 0 || !sessionId) return;
  const pings = [...pingBuffer];
  pingBuffer = [];
  try {
    await sendGPSBatch(deviceHash, sessionId, pings, tripMeta);
  } catch {
    pingBuffer.unshift(...pings);
  }
}

export { flushBuffer };
