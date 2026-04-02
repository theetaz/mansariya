const API_BASE_URL = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "")

const ADMIN_API_KEY = import.meta.env.VITE_API_KEY || "mansariya-dev-key"

// ── Types ────────────────────────────────────────────────────────────────

export type DashboardStats = {
  total_routes: number
  total_stops: number
  active_routes: number
  routes_with_stops: number
  routes_with_polyline: number
  routes_with_timetable: number
}

export type ActiveBusesResponse = {
  count: number
}

export type SimulationActiveResponse = {
  running_jobs: number
  total_buses: number
  total_devices: number
}

export type ServiceHealth = {
  name: string
  status: "ok" | "down" | "unknown" | string
  message?: string
}

export type SystemHealthResponse = {
  status: string
  checked_at: string
  services: ServiceHealth[]
}

export type DashboardSnapshot = {
  stats: DashboardStats
  activeBusesCount: number
  simulations: SimulationActiveResponse
}

export type AdminRouteWithStats = {
  id: string
  name_en: string
  name_si: string
  name_ta: string
  operator: string
  service_type: string
  fare_lkr: number
  frequency_minutes: number
  operating_hours: string
  is_active: boolean
  stop_count: number
  has_polyline: boolean
  pattern_count: number
  origin_stop_name: string
  destination_stop_name: string
}

export type AdminRoutesResponse = {
  routes: AdminRouteWithStats[]
  count: number
}

export type Stop = {
  id: string
  name_en: string
  name_si: string
  name_ta: string
  location: [number, number]
  source: string
  confidence: number
  observation_count: number
  created_at: string
}

export type TimetableInput = {
  route_id: string
  departure_time: string
  days: string[]
  service_type: string
  notes?: string
}

export type SimulationStatus = "draft" | "running" | "paused" | "stopped"

export type SimulationJob = {
  id: string
  route_id: string
  name: string
  status: SimulationStatus
  ping_interval_sec: number
  default_speed_min_kmh: number
  default_speed_max_kmh: number
  default_dwell_min_sec: number
  default_dwell_max_sec: number
  created_at: string
  updated_at: string
  vehicle_count?: number
  device_count?: number
  route_name?: string
}

export type SimulationsResponse = {
  simulations: SimulationJob[]
  count: number
}

export type HealthResponse = {
  status: string
  service: string
}

export type Vehicle = {
  virtual_id: string
  route_id: string
  lat: number
  lng: number
  speed_kmh: number
  bearing: number
  contributor_count: number
  confidence: "low" | "good" | "verified"
  last_update: string
}

export type ActiveBusesDetailResponse = {
  buses: Vehicle[]
  count: number
}

export type AdminEnrichedStop = {
  stop_id: string
  stop_order: number
  name_en: string
  name_si: string
  name_ta: string
  lat: number
  lng: number
  distance_from_start_km: number
  typical_duration_min: number
  fare_from_start_lkr: number
  is_terminal: boolean
}

export type AdminRouteDetail = {
  route: AdminRouteWithStats
  stops: AdminEnrichedStop[]
  patterns: unknown[]
  timetable: unknown[]
  polyline: [number, number][]
}

// ── Fetch helpers ────────────────────────────────────────────────────────

async function apiGet<T>(path: string, admin = false): Promise<T> {
  const headers: HeadersInit = { Accept: "application/json" }
  if (admin) headers["X-API-Key"] = ADMIN_API_KEY

  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`API ${response.status}: ${body || response.statusText}`)
  }
  return (await response.json()) as T
}

async function apiMutate<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-API-Key": ADMIN_API_KEY,
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`API ${response.status}: ${text || response.statusText}`)
  }
  return (await response.json()) as T
}

// ── Dashboard ────────────────────────────────────────────────────────────

export function fetchDashboardStats() {
  return apiGet<DashboardStats>("/api/v1/admin/stats", true)
}

export function fetchActiveBuses() {
  return apiGet<ActiveBusesResponse>("/api/v1/buses/active")
}

export function fetchSimulationActiveStats() {
  return apiGet<SimulationActiveResponse>(
    "/api/v1/admin/simulations/active",
    true
  )
}

export function fetchSystemHealth() {
  return apiGet<SystemHealthResponse>("/api/v1/admin/system/health", true)
}

export function fetchHealth() {
  return apiGet<HealthResponse>("/")
}

// ── Routes ───────────────────────────────────────────────────────────────

export function fetchAdminRoutes() {
  return apiGet<AdminRoutesResponse>("/api/v1/admin/routes", true)
}

export function deleteRoute(id: string) {
  return apiMutate<unknown>("DELETE", `/api/v1/admin/routes/${id}`)
}

export function setRouteActive(id: string, isActive: boolean) {
  return apiMutate<unknown>("PUT", `/api/v1/admin/routes/${id}/status`, {
    is_active: isActive,
  })
}

// ── Stops ────────────────────────────────────────────────────────────────

export function fetchNearbyStops() {
  return apiGet<Stop[]>("/api/v1/stops/nearby?lat=7.0&lng=80.0&radius_km=500")
}

// ── Timetables ───────────────────────────────────────────────────────────

export function setTimetable(routeId: string, entries: TimetableInput[]) {
  return apiMutate<unknown>(
    "PUT",
    `/api/v1/admin/routes/${routeId}/timetable`,
    { entries }
  )
}

// ── Simulations ──────────────────────────────────────────────────────────

export function fetchSimulations() {
  return apiGet<SimulationsResponse>("/api/v1/admin/simulations", true)
}

export function startSimulation(id: string) {
  return apiMutate<unknown>("POST", `/api/v1/admin/simulations/${id}/start`)
}

export function pauseSimulation(id: string) {
  return apiMutate<unknown>("POST", `/api/v1/admin/simulations/${id}/pause`)
}

export function resumeSimulation(id: string) {
  return apiMutate<unknown>("POST", `/api/v1/admin/simulations/${id}/resume`)
}

export function stopSimulation(id: string) {
  return apiMutate<unknown>("POST", `/api/v1/admin/simulations/${id}/stop`)
}

export function deleteSimulation(id: string) {
  return apiMutate<unknown>("DELETE", `/api/v1/admin/simulations/${id}`)
}

// ── Live Map ─────────────────────────────────────────────────────────────

export function fetchActiveBusesDetail() {
  return apiGet<ActiveBusesDetailResponse>("/api/v1/buses/active")
}

export function fetchAdminRouteDetail(id: string) {
  return apiGet<AdminRouteDetail>(`/api/v1/admin/routes/${id}`, true)
}
