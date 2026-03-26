import axios from 'axios';
import {API_BASE_URL, ENDPOINTS} from '../constants/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Route {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  operator?: string;
  service_type?: string;
  fare_lkr?: number;
  frequency_minutes?: number;
  is_active: boolean;
}

export interface Stop {
  id: string;
  name_en: string;
  name_si?: string;
  name_ta?: string;
  location: [number, number]; // [lng, lat]
}

export interface EnrichedRouteStop {
  route_id: string;
  stop_id: string;
  stop_order: number;
  distance_from_start_km: number;
  typical_duration_min: number;
  fare_from_start_lkr: number;
  stop_name_en: string;
  stop_name_si: string;
  stop_name_ta: string;
  stop_lat: number;
  stop_lng: number;
  is_terminal: boolean;
}

export interface GPSPing {
  lat: number;
  lng: number;
  ts: number;
  acc: number;
  spd: number;
  brg: number;
}

export interface BusPosition {
  virtual_id: string;
  route_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  bearing: number;
  contributor_count: number;
  confidence: 'low' | 'good' | 'verified';
  last_update: string;
}

export interface JourneyResult {
  route: Route;
  board_stop: EnrichedRouteStop;
  exit_stop: EnrichedRouteStop;
  stops_between: number;
  estimated_duration_min: number;
  fare_lkr: number;
  live_bus_count: number;
}

// GPS batch upload
export async function sendGPSBatch(
  deviceHash: string,
  sessionId: string,
  pings: GPSPing[],
) {
  return api.post(ENDPOINTS.GPS_BATCH, {
    device_hash: deviceHash,
    session_id: sessionId,
    pings,
  });
}

// Route queries
export async function fetchNearbyRoutes(
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<Route[]> {
  const {data} = await api.get(ENDPOINTS.ROUTES, {
    params: {lat, lng, radius_km: radiusKm},
  });
  return data;
}

export async function fetchRouteDetail(routeId: string) {
  const {data} = await api.get(ENDPOINTS.ROUTE_DETAIL(routeId));
  return data as {route: Route; stops: Stop[]};
}

// Enriched route stops (with timing, fares)
export async function fetchRouteStops(routeId: string): Promise<EnrichedRouteStop[]> {
  const {data} = await api.get(`${ENDPOINTS.ROUTES}/${routeId}/stops`);
  return data;
}

// Search
export async function searchRoutes(
  query: string,
  limit = 20,
): Promise<{results: Route[]; count: number}> {
  const {data} = await api.get(ENDPOINTS.SEARCH, {
    params: {q: query, limit},
  });
  return data;
}

// Journey search
export async function searchJourney(
  from: string,
  to: string,
): Promise<{origin: Stop; destination: Stop; journeys: JourneyResult[]}> {
  const {data} = await api.get('/api/v1/journey', {
    params: {from, to},
  });
  return data;
}

// Stop search (autocomplete)
export async function searchStops(query: string): Promise<Stop[]> {
  const {data} = await api.get('/api/v1/stops/search', {
    params: {q: query},
  });
  return data;
}

// Nearby stops
export async function fetchNearbyStops(
  lat: number,
  lng: number,
  radiusKm = 1,
): Promise<Stop[]> {
  const {data} = await api.get(ENDPOINTS.NEARBY_STOPS, {
    params: {lat, lng, radius_km: radiusKm},
  });
  return data;
}

export default api;
