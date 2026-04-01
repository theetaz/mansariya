import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { DashboardSnapshot, ServiceHealth, SystemHealthResponse } from "@/lib/api"

function formatFraction(value: number, total: number) {
  if (total === 0) {
    return "0%"
  }

  return `${Math.round((value / total) * 100)}%`
}

function statusBadgeVariant(status: string) {
  if (status === "down") {
    return "destructive" as const
  }

  if (status === "ok") {
    return "secondary" as const
  }

  return "outline" as const
}

function formatStatus(status: string) {
  if (status === "ok") {
    return "Healthy"
  }

  if (status === "down") {
    return "Down"
  }

  return "Unknown"
}

function HealthRow({ service }: { service: ServiceHealth }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium capitalize">{service.name}</p>
        <p className="text-sm text-muted-foreground">
          {service.message || "Responding normally"}
        </p>
      </div>
      <Badge variant={statusBadgeVariant(service.status)}>
        {formatStatus(service.status)}
      </Badge>
    </div>
  )
}

export function DashboardPanels({
  snapshot,
  health,
}: {
  snapshot: DashboardSnapshot | null
  health: SystemHealthResponse | null
}) {
  const stats = snapshot?.stats
  const services = health?.services || []

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @6xl/main:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Service Health</CardTitle>
          <CardDescription>
            Live dependency checks for the admin portal backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {services.length > 0 ? (
            services.map((service, index) => (
              <div key={service.name} className="flex flex-col gap-4">
                <HealthRow service={service} />
                {index < services.length - 1 ? <Separator /> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Service health data is not available yet.
            </p>
          )}
          {health?.checked_at ? (
            <p className="text-xs text-muted-foreground">
              Checked {new Date(health.checked_at).toLocaleTimeString()}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Readiness</CardTitle>
          <CardDescription>
            Coverage snapshot from the current admin dataset.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Stops mapped</p>
              <p className="text-sm text-muted-foreground">
                Routes with ordered stop data.
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">
                {stats ? `${stats.routes_with_stops}/${stats.total_routes}` : "--"}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats
                  ? formatFraction(stats.routes_with_stops, stats.total_routes)
                  : "--"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Polylines ready</p>
              <p className="text-sm text-muted-foreground">
                Routes with geometry ready for map rendering.
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">
                {stats
                  ? `${stats.routes_with_polyline}/${stats.total_routes}`
                  : "--"}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats
                  ? formatFraction(stats.routes_with_polyline, stats.total_routes)
                  : "--"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Timetables published</p>
              <p className="text-sm text-muted-foreground">
                Routes with schedule entries attached.
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">
                {stats
                  ? `${stats.routes_with_timetable}/${stats.total_routes}`
                  : "--"}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats
                  ? formatFraction(stats.routes_with_timetable, stats.total_routes)
                  : "--"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
