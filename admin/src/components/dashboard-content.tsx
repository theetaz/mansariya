import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardPanels } from "@/components/dashboard-panels"
import { SectionCards } from "@/components/section-cards"
import {
  useActiveBuses,
  useDashboardStats,
  useSimulationStats,
  useSystemHealth,
} from "@/hooks/use-dashboard-queries"
import type { DashboardSnapshot } from "@/lib/api"

export function DashboardContent() {
  const stats = useDashboardStats()
  const buses = useActiveBuses()
  const simulations = useSimulationStats()
  const health = useSystemHealth()

  const isLoading = stats.isLoading || buses.isLoading || simulations.isLoading

  const snapshot: DashboardSnapshot | null =
    stats.data && buses.data && simulations.data
      ? {
          stats: stats.data,
          activeBusesCount: buses.data.count,
          simulations: simulations.data,
        }
      : null

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards snapshot={snapshot} isLoading={isLoading} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DashboardPanels
        snapshot={snapshot}
        health={health.data ?? null}
        isLoading={isLoading}
        isHealthLoading={health.isLoading}
      />
    </div>
  )
}
