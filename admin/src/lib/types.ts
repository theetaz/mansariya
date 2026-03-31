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

// ── Simulation ──
export type SimulationStatus = 'draft' | 'running' | 'paused' | 'stopped';

export interface SimulationJob {
  id: string;
  route_id: string;
  name: string;
  status: SimulationStatus;
  ping_interval_sec: number;
  default_speed_min_kmh: number;
  default_speed_max_kmh: number;
  default_dwell_min_sec: number;
  default_dwell_max_sec: number;
  created_at: string;
  updated_at: string;
  vehicle_count?: number;
  device_count?: number;
  route_name?: string;
}

export interface SimulationVehicle {
  id: string;
  job_id: string;
  vehicle_id: string;
  passenger_count: number;
  speed_min_kmh?: number | null;
  speed_max_kmh?: number | null;
  dwell_min_sec?: number | null;
  dwell_max_sec?: number | null;
  start_stop_id?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  ping_interval_sec?: number | null;
}

export interface SimulationVehicleInput {
  vehicle_id: string;
  passenger_count: number;
  speed_min_kmh?: number | null;
  speed_max_kmh?: number | null;
  dwell_min_sec?: number | null;
  dwell_max_sec?: number | null;
  start_stop_id?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  ping_interval_sec?: number | null;
}

export interface SimulationJobInput {
  route_id: string;
  name: string;
  ping_interval_sec: number;
  default_speed_min_kmh: number;
  default_speed_max_kmh: number;
  default_dwell_min_sec: number;
  default_dwell_max_sec: number;
  vehicles: SimulationVehicleInput[];
}

export interface SimulationJobDetail {
  job: SimulationJob;
  vehicles: SimulationVehicle[];
}

export interface SimulationActiveResponse {
  running_jobs: number;
  total_buses: number;
  total_devices: number;
}

// ── Device (Data Provider) ──
export type DeviceClassification = 'noise' | 'potential' | 'cluster' | 'confirmed';
export type DeviceQualityStatus = 'ok' | 'low_accuracy' | 'out_of_service_region';
export type DeviceFreshnessStatus = 'active' | 'suspect' | 'disconnected';

export interface DeviceInfo {
  contributor_id: string;
  classification: DeviceClassification;
  classification_reason: string;
  quality_status: DeviceQualityStatus;
  freshness_status: DeviceFreshnessStatus;
  lat: number;
  lng: number;
  speed_kmh: number;
  bearing: number;
  accuracy: number;
  route_id: string;
  bus_number: string;
  crowd_level: number;
  has_metadata: boolean;
  last_seen: string;
}

export interface DeviceCounts {
  total: number;
  noise: number;
  potential: number;
  cluster: number;
  confirmed: number;
  active: number;
  suspect: number;
  disconnected: number;
}

export interface DevicesUpdate {
  type: 'devices_update';
  snapshot_version: number;
  devices: DeviceInfo[];
  counts: DeviceCounts;
}
