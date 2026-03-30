import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};
const DEV_URL_IOS = extra.API_URL_IOS ?? 'http://localhost:9900';
const DEV_URL_ANDROID = extra.API_URL_ANDROID ?? 'http://10.0.2.2:9900';
const PROD_URL = extra.API_URL_PROD ?? 'https://api.masariya.lk';

export const API_BASE_URL = __DEV__
  ? Platform.select({ ios: DEV_URL_IOS, android: DEV_URL_ANDROID, default: DEV_URL_IOS })!
  : PROD_URL;

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

export const ENDPOINTS = {
  GPS_BATCH: '/api/v1/gps/batch',
  ROUTES: '/api/v1/routes',
  ROUTE_DETAIL: (id: string) => `/api/v1/routes/${id}`,
  ROUTE_ETA: (id: string) => `/api/v1/routes/${id}/eta`,
  SEARCH: '/api/v1/search',
  NEARBY_STOPS: '/api/v1/stops/nearby',
  ROUTES_SYNC: '/api/v1/routes/sync',
  WS_TRACK: (routeId: string) => `/ws/track/${routeId}`,
};
