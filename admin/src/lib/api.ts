import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key to admin requests
api.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey && config.url?.includes('/admin')) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

export default api;

// ── Types ──

export interface Route {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  operator: string;
  service_type: string;
  fare_lkr: number;
  frequency_minutes: number;
  operating_hours: string;
  polyline: [number, number][];
  polyline_confidence: number;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stop {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  location: [number, number];
  source: string;
  confidence: number;
  observation_count: number;
  created_at: string;
}

export interface Vehicle {
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

export interface Metrics {
  uptime_seconds: number;
  uptime_human: string;
  goroutines: number;
  memory_alloc_mb: number;
  memory_sys_mb: number;
  gc_runs: number;
  active_buses: number;
  stream_gps_raw: number;
  stream_gps_matched: number;
  redis_connected: boolean;
}

export interface HealthResponse {
  status: string;
  service: string;
  docs: string;
  health: string;
  api: string;
}

// ── API Functions ──

export const fetchHealth = () => api.get<HealthResponse>('/').then(r => r.data);
export const fetchMetrics = () => api.get<Metrics>('/api/v1/metrics').then(r => r.data);
export const fetchRoutes = () => api.get<{ routes: Route[]; count: number }>('/api/v1/routes/sync').then(r => r.data);
export const fetchRoute = (id: string) => api.get<{ route: Route; stops: Stop[] }>(`/api/v1/routes/${id}`).then(r => r.data);
export const fetchActiveBuses = () => api.get<{ buses: Vehicle[]; count: number }>('/api/v1/buses/active').then(r => r.data);
export const searchRoutes = (q: string) => api.get<{ results: Route[]; count: number }>(`/api/v1/search?q=${encodeURIComponent(q)}`).then(r => r.data);

// Admin
export const createRoute = (data: Record<string, unknown>) => api.post('/api/v1/admin/routes', data).then(r => r.data);
export const updateRoute = (id: string, data: Record<string, unknown>) => api.put(`/api/v1/admin/routes/${id}`, data).then(r => r.data);
export const deleteRoute = (id: string) => api.delete(`/api/v1/admin/routes/${id}`).then(r => r.data);
export const createStop = (data: Record<string, unknown>) => api.post('/api/v1/admin/stops', data).then(r => r.data);
export const updateStop = (id: string, data: Record<string, unknown>) => api.put(`/api/v1/admin/stops/${id}`, data).then(r => r.data);
export const setRouteStops = (routeId: string, stops: Record<string, unknown>[]) => api.put(`/api/v1/admin/routes/${routeId}/stops`, { stops }).then(r => r.data);
export const setTimetable = (routeId: string, entries: Record<string, unknown>[]) => api.put(`/api/v1/admin/routes/${routeId}/timetable`, { entries }).then(r => r.data);
