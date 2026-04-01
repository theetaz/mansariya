import * as React from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardPanels } from "@/components/dashboard-panels"
import { SectionCards } from "@/components/section-cards"
import {
  fetchActiveBuses,
  fetchDashboardStats,
  fetchSimulationActiveStats,
  fetchSystemHealth,
  type DashboardSnapshot,
  type SystemHealthResponse,
} from "@/lib/api"

type DashboardState = {
  snapshot: DashboardSnapshot | null
  health: SystemHealthResponse | null
}

export function DashboardContent() {
  const [state, setState] = React.useState<DashboardState>({
    snapshot: null,
    health: null,
  })

  React.useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      const [statsResult, busesResult, simulationsResult, healthResult] =
        await Promise.allSettled([
          fetchDashboardStats(),
          fetchActiveBuses(),
          fetchSimulationActiveStats(),
          fetchSystemHealth(),
        ])

      if (cancelled) {
        return
      }

      React.startTransition(() => {
        setState((current) => ({
          snapshot:
            statsResult.status === "fulfilled" &&
            busesResult.status === "fulfilled" &&
            simulationsResult.status === "fulfilled"
              ? {
                  stats: statsResult.value,
                  activeBusesCount: busesResult.value.count,
                  simulations: simulationsResult.value,
                }
              : current.snapshot,
          health:
            healthResult.status === "fulfilled"
              ? healthResult.value
              : current.health,
        }))
      })
    }

    void loadDashboard()

    const intervalId = window.setInterval(() => {
      void loadDashboard()
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards snapshot={state.snapshot} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DashboardPanels snapshot={state.snapshot} health={state.health} />
    </div>
  )
}
