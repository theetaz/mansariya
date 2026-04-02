import { getAccessToken } from "@/lib/auth"

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "")

export const ADMIN_API_KEY = import.meta.env.VITE_API_KEY || "mansariya-dev-key"

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
  status: "ok" | "down" | "not_running" | "unknown" | string
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

function authHeaders(admin: boolean): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" }
  if (!admin) return headers

  // Prefer JWT token, fall back to API key
  const token = getAccessToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  } else {
    headers["X-API-Key"] = ADMIN_API_KEY
  }
  return headers
}

// Parse backend error envelope: { error: { code, message, field? } }
async function parseAPIError(response: Response): Promise<Error> {
  try {
    const body = await response.json()
    if (body?.error?.message) {
      return new Error(body.error.message)
    }
  } catch {
    // fallback
  }
  return new Error(`Request failed (${response.status})`)
}

async function apiGet<T>(path: string, admin = false): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(admin),
  })
  if (!response.ok) {
    throw await parseAPIError(response)
  }
  return (await response.json()) as T
}

async function apiMutate<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: HeadersInit = {
    ...authHeaders(true),
    "Content-Type": "application/json",
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw await parseAPIError(response)
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

export type AdminRoutesParams = {
  q?: string
  operator?: string
  service_type?: string
  is_active?: string
  sort_by?: string
  sort_dir?: string
  page?: number
  per_page?: number
}

export type AdminRoutesServerResponse = {
  routes: AdminRouteWithStats[]
  count: number
  page: number
  per_page: number
  total_pages: number
}

export function fetchAdminRoutes(params?: AdminRoutesParams) {
  const q = new URLSearchParams()
  if (params?.q) q.set("q", params.q)
  if (params?.operator) q.set("operator", params.operator)
  if (params?.service_type) q.set("service_type", params.service_type)
  if (params?.is_active) q.set("is_active", params.is_active)
  if (params?.sort_by) q.set("sort_by", params.sort_by)
  if (params?.sort_dir) q.set("sort_dir", params.sort_dir)
  if (params?.page) q.set("page", String(params.page))
  if (params?.per_page) q.set("per_page", String(params.per_page))
  const qs = q.toString()
  return apiGet<AdminRoutesServerResponse>(
    `/api/v1/admin/routes${qs ? `?${qs}` : ""}`, true
  )
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

export type SimulationsParams = {
  search?: string
  status?: string
  sort_by?: string
  sort_dir?: string
  limit?: number
  offset?: number
}

export function fetchSimulations(params?: SimulationsParams) {
  const q = new URLSearchParams()
  if (params?.search) q.set("search", params.search)
  if (params?.status) q.set("status", params.status)
  if (params?.sort_by) q.set("sort_by", params.sort_by)
  if (params?.sort_dir) q.set("sort_dir", params.sort_dir)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiGet<{ simulations: SimulationJob[]; total: number; limit: number; offset: number }>(
    `/api/v1/admin/simulations${qs ? `?${qs}` : ""}`, true
  )
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

// ── User management ─────────────────────────────────────────────────────

export type AdminUser = {
  id: string
  email: string
  display_name: string
  status: "invited" | "active" | "disabled"
  last_login_at: string | null
  created_at: string
  roles: { id: string; slug: string; name: string }[]
}

export type AdminRole = {
  id: string
  slug: string
  name: string
  description: string
  is_system: boolean
}

export type AdminSession = {
  id: string
  ip_address: string
  user_agent: string
  created_at: string
  last_used_at: string
  expires_at: string
}

export type AdminUsersParams = {
  search?: string
  status?: string
  sort_by?: string
  sort_dir?: string
  limit?: number
  offset?: number
}

export function fetchAdminUsers(params?: AdminUsersParams) {
  const q = new URLSearchParams()
  if (params?.search) q.set("search", params.search)
  if (params?.status) q.set("status", params.status)
  if (params?.sort_by) q.set("sort_by", params.sort_by)
  if (params?.sort_dir) q.set("sort_dir", params.sort_dir)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiGet<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
    `/api/v1/admin/users${qs ? `?${qs}` : ""}`, true
  )
}

export function fetchAdminRoles() {
  return apiGet<{ roles: AdminRole[] }>("/api/v1/admin/roles", true)
}

export function inviteUser(email: string, displayName: string, roleIds: string[]) {
  return apiMutate<{ user: AdminUser; invite_token: string }>(
    "POST", "/api/v1/admin/users/invite",
    { email, display_name: displayName, role_ids: roleIds }
  )
}

export function updateUserStatus(userId: string, status: "active" | "disabled") {
  return apiMutate<{ status: string }>(
    "PUT", `/api/v1/admin/users/${userId}/status`,
    { status }
  )
}

export function assignUserRole(userId: string, roleId: string) {
  return apiMutate<{ status: string }>(
    "POST", `/api/v1/admin/users/${userId}/roles`,
    { role_id: roleId }
  )
}

export function removeUserRole(userId: string, roleId: string) {
  return apiMutate<{ status: string }>(
    "DELETE", `/api/v1/admin/users/${userId}/roles/${roleId}`
  )
}

export function fetchUserSessions(userId: string) {
  return apiGet<{ sessions: AdminSession[]; count: number }>(
    `/api/v1/admin/users/${userId}/sessions`, true
  )
}

export function revokeUserSession(userId: string, sessionId: string) {
  return apiMutate<{ status: string }>(
    "DELETE", `/api/v1/admin/users/${userId}/sessions/${sessionId}`
  )
}

export function revokeAllUserSessions(userId: string) {
  return apiMutate<{ status: string }>(
    "DELETE", `/api/v1/admin/users/${userId}/sessions`
  )
}

// ── Role management ─────────────────────────────────────────────────────

export type AdminPermission = {
  id: string
  slug: string
  name: string
  family: string
  description: string
}

export function fetchAdminPermissions() {
  return apiGet<{ permissions: AdminPermission[] }>("/api/v1/admin/permissions", true)
}

export function createRole(slug: string, name: string, description: string) {
  return apiMutate<AdminRole>("POST", "/api/v1/admin/roles", { slug, name, description })
}

export function updateRole(roleId: string, name: string, description: string) {
  return apiMutate<{ status: string }>("PUT", `/api/v1/admin/roles/${roleId}`, { name, description })
}

export function deleteRole(roleId: string) {
  return apiMutate<{ status: string }>("DELETE", `/api/v1/admin/roles/${roleId}`)
}

export function fetchRolePermissions(roleId: string) {
  return apiGet<{ permissions: AdminPermission[] }>(`/api/v1/admin/roles/${roleId}/permissions`, true)
}

export function setRolePermissions(roleId: string, permissionIds: string[]) {
  return apiMutate<{ status: string }>("PUT", `/api/v1/admin/roles/${roleId}/permissions`, { permission_ids: permissionIds })
}

// ── Audit logs ──────────────────────────────────────────────────────────

export type AuditEntry = {
  id: number
  actor_id: string
  actor_email: string
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, string>
  ip_address: string
  user_agent: string
  created_at: string
}

export type AuditLogsParams = {
  action?: string
  actor_email?: string
  target_type?: string
  search?: string
  sort_by?: string
  sort_dir?: string
  limit?: number
  offset?: number
}

export type AuditLogsResponse = {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export function fetchAuditLogs(params?: AuditLogsParams) {
  const q = new URLSearchParams()
  if (params?.action) q.set("action", params.action)
  if (params?.actor_email) q.set("actor_email", params.actor_email)
  if (params?.target_type) q.set("target_type", params.target_type)
  if (params?.search) q.set("search", params.search)
  if (params?.sort_by) q.set("sort_by", params.sort_by)
  if (params?.sort_dir) q.set("sort_dir", params.sort_dir)
  if (params?.limit) q.set("limit", String(params.limit))
  if (params?.offset) q.set("offset", String(params.offset))
  const qs = q.toString()
  return apiGet<AuditLogsResponse>(
    `/api/v1/admin/audit-logs${qs ? `?${qs}` : ""}`, true
  )
}
