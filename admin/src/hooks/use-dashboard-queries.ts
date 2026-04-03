import { useQuery } from "@tanstack/react-query"

import {
  fetchActiveBuses,
  fetchAdminRoutes,
  fetchDashboardStats,
  fetchSimulationActiveStats,
  fetchSystemHealth,
} from "@/lib/api"

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 60_000,
  })
}

export function useActiveBuses() {
  return useQuery({
    queryKey: ["active-buses"],
    queryFn: fetchActiveBuses,
    refetchInterval: 15_000,
  })
}

export function useSimulationStats() {
  return useQuery({
    queryKey: ["simulation-active-stats"],
    queryFn: fetchSimulationActiveStats,
    staleTime: 60_000,
  })
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useAdminRoutes() {
  return useQuery({
    queryKey: ["admin-routes"],
    queryFn: fetchAdminRoutes,
    staleTime: 60_000,
  })
}
