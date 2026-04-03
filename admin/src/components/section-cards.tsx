import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardSnapshot } from "@/lib/api"
import {
  ActivityIcon,
  BusFrontIcon,
  MapPinnedIcon,
  RouteIcon,
} from "lucide-react"

function formatMetric(value: number | undefined) {
  if (typeof value !== "number") {
    return "--"
  }

  return value.toLocaleString()
}

function formatCoverage(value: number, total: number) {
  if (total === 0) {
    return "0%"
  }

  return `${Math.round((value / total) * 100)}%`
}

export function SectionCards({
  snapshot,
  isLoading,
}: {
  snapshot: DashboardSnapshot | null
  isLoading: boolean
}) {
  const stats = snapshot?.stats
  const simulations = snapshot?.simulations

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Routes</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              formatMetric(stats?.total_routes)
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <RouteIcon />
              {formatMetric(stats?.active_routes)} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Stop coverage is live
            <MapPinnedIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {formatMetric(stats?.routes_with_stops)} routes already include
            mapped stops
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Stops</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              formatMetric(stats?.total_stops)
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <MapPinnedIcon />
              {formatMetric(stats?.routes_with_timetable)} scheduled routes
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Timetable rollout is progressing
            <ActivityIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {formatMetric(stats?.routes_with_polyline)} routes already have
            polylines
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Live Buses</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              formatMetric(snapshot?.activeBusesCount)
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <BusFrontIcon />
              {formatMetric(simulations?.total_buses)} simulated buses
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Real-time feed is connected
            <ActivityIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {formatMetric(simulations?.total_devices)} devices are attached to
            active simulations
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Route Coverage</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats ? (
              formatCoverage(stats.routes_with_polyline, stats.total_routes)
            ) : (
              "--"
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ActivityIcon />
              {formatMetric(simulations?.running_jobs)} jobs running
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Geometry readiness across routes
            <RouteIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {formatMetric(stats?.routes_with_timetable)} routes already expose
            timetable data
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
