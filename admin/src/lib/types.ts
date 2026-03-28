// ── Route ──
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

export interface AdminRouteWithStats {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  operator: string;
  service_type: string;
  fare_lkr: number;
  frequency_minutes: number;
  operating_hours: string;
  is_active: boolean;
  stop_count: number;
  has_polyline: boolean;
  pattern_count: number;
  origin_stop_name: string;
  destination_stop_name: string;
}

export interface AdminRouteInput {
  id: string;
  name_en: string;
  name_si?: string;
  name_ta?: string;
  operator?: string;
  service_type?: string;
  fare_lkr?: number;
  frequency_minutes?: number;
  operating_hours?: string;
  data_source?: string;
}

// ── Stop ──
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

export interface AdminStopInput {
  id: string;
  name_en: string;
  name_si?: string;
  name_ta?: string;
  lat: number;
  lng: number;
  road_name?: string;
  landmark?: string;
  is_terminal?: boolean;
}

// ── Vehicle ──
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

// ── Timetable ──
export interface Timetable {
  id: number;
  route_id: string;
  departure_time: string;
  days: string[];
  service_type: string;
  notes: string;
  created_at: string;
}

export interface TimetableInput {
  route_id: string;
  departure_time: string;
  days: string[];
  service_type: string;
  notes?: string;
}

// ── Dashboard ──
export interface DashboardStats {
  total_routes: number;
  total_stops: number;
  active_routes: number;
  routes_with_stops: number;
  routes_with_polyline: number;
  routes_with_timetable: number;
}

export interface HealthResponse {
  status: string;
  service: string;
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

// ── Route Stops ──
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

// ── Route Pattern ──
export interface AdminRoutePattern {
  id: string;
  route_id: string;
  headsign: string;
  direction: number;
  is_primary: boolean;
  stop_count: number;
  source: string;
  has_polyline: boolean;
}

// ── Route Detail (composite endpoint response) ──
export interface AdminRouteDetail {
  route: AdminRouteDetailInfo;
  stops: AdminEnrichedStop[];
  patterns: AdminRoutePattern[];
  timetable: AdminTimetableEntry[];
  polyline: [number, number][];
}

export interface AdminRouteDetailInfo {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  operator: string;
  service_type: string;
  fare_lkr: number;
  frequency_minutes: number;
  operating_hours: string;
  is_active: boolean;
  source: string;
  data_source: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminEnrichedStop {
  stop_id: string;
  stop_order: number;
  name_en: string;
  name_si: string;
  name_ta: string;
  lat: number;
  lng: number;
  distance_from_start_km: number;
  typical_duration_min: number;
  fare_from_start_lkr: number;
  is_terminal: boolean;
}

export interface AdminTimetableEntry {
  id: number;
  route_id: string;
  departure_time: string;
  days: string[];
  service_type: string;
  notes: string;
}

// ── Paginated route list response ──
export interface AdminRouteListResponse {
  routes: AdminRouteWithStats[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}
