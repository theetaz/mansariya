const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(
  /\/$/,
  ""
)
const ADMIN_API_KEY = import.meta.env.VITE_API_KEY || "mansariya-dev-key"

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

async function apiGet<T>(path: string, admin = false): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  })

  if (admin) {
    headers.set("X-API-Key", ADMIN_API_KEY)
  }

  const response = await fetch(`${API_URL}${path}`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function fetchDashboardStats() {
  return apiGet<DashboardStats>("/api/v1/admin/stats", true)
}

export function fetchActiveBuses() {
  return apiGet<ActiveBusesResponse>("/api/v1/buses/active")
}

export function fetchSimulationActiveStats() {
  return apiGet<SimulationActiveResponse>("/api/v1/admin/simulations/active", true)
}

export function fetchSystemHealth() {
  return apiGet<SystemHealthResponse>("/api/v1/admin/system/health", true)
}
