import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const INSTALL_SECRET_KEY = 'mansariya:tracking:install-secret:v1';
const ACTIVE_SESSION_KEY = 'mansariya:tracking:active-session:v1';
const CONTRIBUTOR_ID_KEY = 'mansariya:tracking:contributor-id:v1';

export const TRACKING_IDENTITY_VERSION = 1;

export type TrackingSession = {
  identityVersion: number;
  deviceHash: string;
  contributorId: string;
  sessionId: string;
  sessionStartedAt: number;
  nextBatchSeq: number;
};

function randomToken(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function buildSessionID(): string {
  return `sess_${Date.now().toString(36)}_${randomToken().slice(0, 12)}`;
}

function dayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getOrCreateInstallSecret(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALL_SECRET_KEY);
  if (existing) {
    return existing;
  }

  const secret = `install_${randomToken()}_${randomToken()}`;
  await AsyncStorage.setItem(INSTALL_SECRET_KEY, secret);
  return secret;
}

/**
 * Returns a stable contributor ID derived from the install secret.
 * Persists across sessions, device_hash rotations, and app restarts.
 * Only changes on app reinstall (new install secret).
 */
export async function getOrCreateContributorId(): Promise<string> {
  const existing = await AsyncStorage.getItem(CONTRIBUTOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const secret = await getOrCreateInstallSecret();
  const payload = `mansariya:contributor:v1:${secret}`;
  const id = bytesToHex(sha256(utf8ToBytes(payload))).slice(0, 32);
  await AsyncStorage.setItem(CONTRIBUTOR_ID_KEY, id);
  return id;
}

async function deriveDailyDeviceHash(date: Date): Promise<string> {
  const secret = await getOrCreateInstallSecret();
  const payload = `mansariya:${TRACKING_IDENTITY_VERSION}:${dayBucket(date)}:${secret}`;
  return bytesToHex(sha256(utf8ToBytes(payload)));
}

export async function createTrackingSession(now = new Date()): Promise<TrackingSession> {
  const session: TrackingSession = {
    identityVersion: TRACKING_IDENTITY_VERSION,
    deviceHash: await deriveDailyDeviceHash(now),
    contributorId: await getOrCreateContributorId(),
    sessionId: buildSessionID(),
    sessionStartedAt: now.getTime(),
    nextBatchSeq: 1,
  };

  await persistTrackingSession(session);
  return session;
}

export async function getPersistedTrackingSession(): Promise<TrackingSession | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TrackingSession;
    if (!parsed.deviceHash || !parsed.sessionId || !parsed.sessionStartedAt) {
      return null;
    }
    return {
      identityVersion: parsed.identityVersion || TRACKING_IDENTITY_VERSION,
      deviceHash: parsed.deviceHash,
      contributorId: parsed.contributorId || '',
      sessionId: parsed.sessionId,
      sessionStartedAt: parsed.sessionStartedAt,
      nextBatchSeq: parsed.nextBatchSeq || 1,
    };
  } catch {
    return null;
  }
}

export async function persistTrackingSession(session: TrackingSession): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export async function clearTrackingSession(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
}
