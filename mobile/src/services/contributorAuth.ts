import * as SecureStore from 'expo-secure-store';
import type {AxiosInstance, InternalAxiosRequestConfig} from 'axios';
import {contributorRefresh, fetchContributorProfile} from './contributorApi';
import {useContributorStore} from '../stores/useContributorStore';

// ── SecureStore keys ─────────────────────────────────────────────────────

const KEY_ACCESS = 'mansariya:contributor:access_token';
const KEY_REFRESH = 'mansariya:contributor:refresh_token';
const KEY_EXPIRES = 'mansariya:contributor:expires_at';

// ── Endpoints that require the Bearer header ─────────────────────────────

const AUTH_PATHS = [
  '/api/v1/contributor/me',
  '/api/v1/contributor/stats',
  '/api/v1/contributor/claim',
];

// ── Token helpers ────────────────────────────────────────────────────────

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
    SecureStore.setItemAsync(KEY_EXPIRES, expiresAt),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_EXPIRES),
  ]);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(KEY_ACCESS);
  return !!token;
}

async function isTokenExpired(): Promise<boolean> {
  const expiresAt = await SecureStore.getItemAsync(KEY_EXPIRES);
  if (!expiresAt) return true;
  // Consider expired 60 seconds before actual expiry
  return new Date(expiresAt).getTime() - 60_000 < Date.now();
}

// ── Axios interceptor ────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const rt = await getRefreshToken();
  if (!rt) return null;

  try {
    const tokens = await contributorRefresh(rt);
    await saveTokens(tokens.access_token, tokens.refresh_token, tokens.expires_at);
    useContributorStore.getState().setContributor(tokens.contributor);
    useContributorStore.getState().setAuthenticated(true);
    return tokens.access_token;
  } catch {
    await clearTokens();
    useContributorStore.getState().setAuthenticated(false);
    return null;
  }
}

export function setupAuthInterceptor(axiosInstance: AxiosInstance): void {
  // Request interceptor — attach Bearer token for authenticated endpoints
  axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    const needsAuth = AUTH_PATHS.some((p) => url.includes(p));
    if (!needsAuth) return config;

    let token = await getAccessToken();
    const expired = await isTokenExpired();

    if (expired && token) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefresh().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      token = await refreshPromise;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor — handle 401 with one retry after refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const url = original?.url ?? '';
      const needsAuth = AUTH_PATHS.some((p) => url.includes(p));

      if (error.response?.status === 401 && needsAuth && !original._retried) {
        original._retried = true;
        const newToken = await doRefresh();
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(original);
        }
      }
      return Promise.reject(error);
    },
  );
}

// ── Session restore (called once on app startup) ─────────────────────────

export async function restoreSession(): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const store = useContributorStore.getState();
  store.setLoading(true);

  try {
    const expired = await isTokenExpired();
    if (expired) {
      const newToken = await doRefresh();
      if (!newToken) {
        store.setLoading(false);
        return;
      }
    }

    const {contributor, stats} = await fetchContributorProfile();
    store.setContributor(contributor);
    store.setStats(stats);
    store.setAuthenticated(true);
  } catch {
    await clearTokens();
    store.setAuthenticated(false);
  } finally {
    store.setLoading(false);
  }
}
