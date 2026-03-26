// Change these for local development vs production
const DEV_API_URL = 'http://10.0.2.2:8000'; // Android emulator → host machine
const PROD_API_URL = 'https://api.masariya.lk';

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export const ENDPOINTS = {
  GPS_BATCH: '/api/v1/gps/batch',
  ROUTES: '/api/v1/routes',
  ROUTE_DETAIL: (id: string) => `/api/v1/routes/${id}`,
  ROUTE_ETA: (id: string) => `/api/v1/routes/${id}/eta`,
  SEARCH: '/api/v1/search',
  NEARBY_STOPS: '/api/v1/stops/nearby',
  WS_TRACK: (routeId: string) => `/ws/track/${routeId}`,
} as const;
