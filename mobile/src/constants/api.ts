import {Platform} from 'react-native';

// Local dev: iOS simulator uses localhost, Android emulator uses 10.0.2.2
const DEV_API_URL = Platform.select({
  ios: 'http://localhost:8000',
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

const PROD_API_URL = 'https://api.masariya.lk';

export const API_BASE_URL = __DEV__ ? DEV_API_URL! : PROD_API_URL;
export const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export const ENDPOINTS = {
  GPS_BATCH: '/api/v1/gps/batch',
  ROUTES: '/api/v1/routes',
  ROUTE_DETAIL: (id: string) => `/api/v1/routes/${id}`,
  ROUTE_ETA: (id: string) => `/api/v1/routes/${id}/eta`,
  SEARCH: '/api/v1/search',
  NEARBY_STOPS: '/api/v1/stops/nearby',
  ROUTES_SYNC: '/api/v1/routes/sync',
  WS_TRACK: (routeId: string) => `/ws/track/${routeId}`,
} as const;
