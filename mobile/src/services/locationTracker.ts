import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendGPSBatch } from './api';

const BACKGROUND_LOCATION_TASK = 'mansariya-background-location';
const MIN_BATCH_SIZE = 2;
const MAX_BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 10000;

let sessionId = '';
let deviceHash = '';
let pingBuffer: any[] = [];
let tripMeta: { route_id?: string; bus_number?: string; crowd_level?: number } = {};
let lastFlushTime = 0;
let totalPingsSent = 0;
let isFlushInProgress = false;

let onPingCountUpdate: ((count: number) => void) | null = null;

function generateHash(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function setOnPingCountUpdate(cb: ((count: number) => void) | null) {
  onPingCountUpdate = cb;
}

export function getPingCount(): number {
  return totalPingsSent;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[GPS] Background error:', error.message);
    return;
  }
  if (!data || !sessionId || !deviceHash) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) {
    if (pingBuffer.length >= MAX_BUFFER_SIZE) {
      pingBuffer.shift();
    }
    pingBuffer.push({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      ts: Math.floor(location.timestamp / 1000),
      acc: location.coords.accuracy ?? 10,
      spd: Math.max(0, location.coords.speed ?? 0),
      brg: Math.max(0, location.coords.heading ?? 0),
    });
  }

  const now = Date.now();
  const shouldFlush =
    pingBuffer.length >= MIN_BATCH_SIZE ||
    (pingBuffer.length > 0 && now - lastFlushTime >= FLUSH_INTERVAL_MS);

  if (shouldFlush && !isFlushInProgress) {
    await flushBuffer();
  }
});

export async function startTracking(meta?: {
  routeId?: string | null;
  busNumber?: string | null;
  crowdLevel?: number | null;
}): Promise<boolean> {
  const alreadyRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyRunning) return true;

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[GPS] Background permission denied');
  }

  deviceHash = generateHash();
  sessionId = generateHash();
  pingBuffer = [];
  totalPingsSent = 0;
  lastFlushTime = Date.now();
  isFlushInProgress = false;
  tripMeta = {};
  if (meta?.routeId) tripMeta.route_id = meta.routeId;
  if (meta?.busNumber) tripMeta.bus_number = meta.busNumber;
  if (meta?.crowdLevel) tripMeta.crowd_level = meta.crowdLevel;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'Mansariya',
      notificationBody: 'Sharing your bus location',
      notificationColor: '#1D9E75',
    },
  });

  return true;
}

export async function stopTracking(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await flushBuffer();
  tripMeta = {};
  pingBuffer = [];
  sessionId = '';
  deviceHash = '';
  totalPingsSent = 0;
  isFlushInProgress = false;
}

export async function isTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}

export async function recoverTracking(meta?: {
  routeId?: string | null;
  busNumber?: string | null;
  crowdLevel?: number | null;
}): Promise<boolean> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    if (!sessionId) {
      sessionId = generateHash();
      deviceHash = generateHash();
    }
    if (meta?.routeId) tripMeta.route_id = meta.routeId;
    if (meta?.busNumber) tripMeta.bus_number = meta.busNumber;
    if (meta?.crowdLevel) tripMeta.crowd_level = meta.crowdLevel;
    return true;
  }
  return startTracking(meta);
}

export async function forceFlush(): Promise<void> {
  if (pingBuffer.length > 0 && sessionId && deviceHash) {
    await flushBuffer();
  }
}

async function flushBuffer(): Promise<void> {
  if (pingBuffer.length === 0 || !sessionId || !deviceHash || isFlushInProgress) return;

  isFlushInProgress = true;
  const pings = [...pingBuffer];
  pingBuffer = [];

  try {
    await sendGPSBatch(deviceHash, sessionId, pings, tripMeta);
    totalPingsSent += pings.length;
    lastFlushTime = Date.now();
    onPingCountUpdate?.(totalPingsSent);
  } catch {
    pingBuffer.unshift(...pings);
    if (pingBuffer.length > MAX_BUFFER_SIZE) {
      pingBuffer = pingBuffer.slice(-MAX_BUFFER_SIZE);
    }
  } finally {
    isFlushInProgress = false;
  }
}
