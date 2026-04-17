import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { GPSEventType, GPSPing } from './api';
import { sendGPSBatch } from './api';
import {
  clearTrackingSession,
  createTrackingSession,
  getPersistedTrackingSession,
  persistTrackingSession,
  type TrackingSession,
} from './trackingIdentity';
import {useContributorStore} from '../stores/useContributorStore';

const BACKGROUND_LOCATION_TASK = 'mansariya-background-location';
const MIN_BATCH_SIZE = 1;
const MAX_BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000;

let pingBuffer: GPSPing[] = [];
let tripMeta: { route_id?: string; bus_number?: string; crowd_level?: number } = {};
let lastFlushTime = 0;
let totalPingsSent = 0;
let isFlushInProgress = false;
let currentSession: TrackingSession | null = null;

let onPingCountUpdate: ((count: number) => void) | null = null;

async function ensureSessionLoaded(): Promise<TrackingSession | null> {
  if (currentSession) {
    return currentSession;
  }

  currentSession = await getPersistedTrackingSession();
  return currentSession;
}

function pushPing(location: Location.LocationObject) {
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

async function sendBatch(eventType: GPSEventType, pings: GPSPing[]) {
  const session = await ensureSessionLoaded();
  if (!session) {
    return;
  }

  const authContributorId = useContributorStore.getState().contributorId;
  const contributorId = authContributorId ?? session.contributorId;

  await sendGPSBatch(session.deviceHash, session.sessionId, contributorId, pings, tripMeta, {
    event_type: eventType,
    identity_version: session.identityVersion,
    session_started_at: session.sessionStartedAt,
    batch_seq: session.nextBatchSeq,
  });

  session.nextBatchSeq += 1;
  currentSession = session;
  await persistTrackingSession(session);
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
  if (!data) return;

  const session = await ensureSessionLoaded();
  if (!session) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) {
    pushPing(location);
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
  if (alreadyRunning) {
    currentSession = await ensureSessionLoaded();
    if (!currentSession) {
      currentSession = await createTrackingSession();
    }
    return true;
  }

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[GPS] Background permission denied');
  }

  currentSession = await createTrackingSession();
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

  // Send an immediate ping so the device appears on the admin map instantly,
  // without waiting for the background task's first callback + MIN_BATCH_SIZE
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    pushPing(loc);
    const immediatePing = pingBuffer.splice(0, pingBuffer.length);
    await sendBatch('started', immediatePing);
    totalPingsSent += 1;
    lastFlushTime = Date.now();
    onPingCountUpdate?.(totalPingsSent);
  } catch (e) {
    console.warn('[GPS] Failed to send immediate ping:', e);
  }

  return true;
}

export async function stopTracking(): Promise<void> {
  const session = await ensureSessionLoaded();
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await flushBuffer();

  if (session) {
    try {
      await sendBatch('stopped', []);
    } catch (e) {
      console.warn('[GPS] Failed to send stop event:', e);
    }
  }

  tripMeta = {};
  pingBuffer = [];
  totalPingsSent = 0;
  isFlushInProgress = false;
  currentSession = null;
  await clearTrackingSession();
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
    currentSession = await ensureSessionLoaded();
    if (!currentSession) {
      currentSession = await createTrackingSession();
    }
    if (meta?.routeId) tripMeta.route_id = meta.routeId;
    if (meta?.busNumber) tripMeta.bus_number = meta.busNumber;
    if (meta?.crowdLevel) tripMeta.crowd_level = meta.crowdLevel;
    return true;
  }
  return startTracking(meta);
}

export async function forceFlush(): Promise<void> {
  const session = await ensureSessionLoaded();
  if (pingBuffer.length > 0 && session) {
    await flushBuffer();
  }
}

async function flushBuffer(): Promise<void> {
  if (pingBuffer.length === 0 || isFlushInProgress) return;

  const session = await ensureSessionLoaded();
  if (!session) return;

  isFlushInProgress = true;
  const pings = [...pingBuffer];
  pingBuffer = [];

  try {
    await sendBatch('ping', pings);
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
