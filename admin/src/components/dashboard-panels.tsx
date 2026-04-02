import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  DashboardSnapshot,
  ServiceHealth,
  SystemHealthResponse,
} from "@/lib/api"
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleHelpIcon,
  MapPinIcon,
  RouteIcon,
  CalendarClockIcon,
} from "lucide-react"

// ── Service Health ───────────────────────────────────────────────────────

function statusConfig(status: string) {
  if (status === "ok") {
    return {
      label: "Healthy",
      dotClass: "bg-emerald-500",
      pulseClass: "bg-emerald-400",
      borderClass: "border-l-emerald-500/70",
      icon: CheckCircle2Icon,
      iconClass: "text-emerald-500",
    } as const
  }

  if (status === "not_running") {
    return {
      label: "Not Running",
      dotClass: "bg-zinc-400",
      pulseClass: "bg-zinc-300",
      borderClass: "border-l-zinc-400/70",
      icon: CircleHelpIcon,
      iconClass: "text-zinc-400",
    } as const
  }

  if (status === "down") {
    return {
      label: "Down",
      dotClass: "bg-red-500",
      pulseClass: "bg-red-400",
      borderClass: "border-l-red-500/70",
      icon: CircleAlertIcon,
      iconClass: "text-red-500",
    } as const
  }

  return {
    label: "Unknown",
    dotClass: "bg-amber-500",
    pulseClass: "bg-amber-400",
    borderClass: "border-l-amber-500/70",
    icon: CircleHelpIcon,
    iconClass: "text-amber-500",
  } as const
}

function HealthRow({ service }: { service: ServiceHealth }) {
  const config = statusConfig(service.status)
  const Icon = config.icon

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border border-l-[3px] bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60",
        config.borderClass
      )}
    >
      <div className="relative flex-shrink-0">
        {service.status === "ok" && (
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full opacity-40",
              config.pulseClass
            )}
          />
        )}
        <span
          className={cn("relative block size-2.5 rounded-full", config.dotClass)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold capitalize leading-none">
          {service.name}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {service.message || "Responding normally"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5", config.iconClass)} />
        <span
          className={cn(
            "text-xs font-medium",
            service.status === "ok"
              ? "text-emerald-500"
              : service.status === "not_running"
                ? "text-zinc-400"
                : service.status === "down"
                  ? "text-red-500"
                  : "text-amber-500"
          )}
        >
          {config.label}
        </span>
      </div>
    </div>
  )
}

function OverallHealthBadge({ services }: { services: ServiceHealth[] }) {
  // Only count active services (exclude "not_running" optional services)
  const activeServices = services.filter((s) => s.status !== "not_running")
  const total = activeServices.length
  const healthy = activeServices.filter((s) => s.status === "ok").length
  const allHealthy = total > 0 && healthy === total

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        allHealthy
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          : "border-amber-500/20 bg-amber-500/10 text-amber-500"
      )}
    >
      <span className="relative flex size-2">
        {allHealthy && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            allHealthy ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
      </span>
      {allHealthy
        ? `All ${total} services operational`
        : `${healthy}/${total} services healthy`}
    </div>
  )
}

function HealthSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ── Route Readiness ──────────────────────────────────────────────────────

type ReadinessItem = {
  label: string
  description: string
  value: number
  total: number
  icon: React.ComponentType<{ className?: string }>
}

function percentageColor(pct: number) {
  if (pct >= 80) return "text-emerald-500"
  if (pct >= 40) return "text-amber-500"
  return "text-red-500"
}

function barGradient(pct: number) {
  if (pct >= 80)
    return "from-emerald-500/80 to-emerald-400/60"
  if (pct >= 40)
    return "from-amber-500/80 to-amber-400/60"
  return "from-red-500/80 to-red-400/60"
}

function barGlow(pct: number) {
  if (pct >= 80) return "shadow-emerald-500/20"
  if (pct >= 40) return "shadow-amber-500/20"
  return "shadow-red-500/20"
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const pct = item.total === 0 ? 0 : Math.round((item.value / item.total) * 100)
  const Icon = item.icon

  return (
    <div className="group space-y-2.5 rounded-lg border bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular-nums", percentageColor(pct))}>
            {pct}%
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {item.value}/{item.total}
          </p>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r shadow-sm transition-all duration-700 ease-out",
            barGradient(pct),
            barGlow(pct)
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function OverallReadinessBadge({
  items,
}: {
  items: ReadinessItem[]
}) {
  const totalValue = items.reduce((sum, i) => sum + i.value, 0)
  const totalMax = items.reduce((sum, i) => sum + i.total, 0)
  const overallPct = totalMax === 0 ? 0 : Math.round((totalValue / totalMax) * 100)

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        overallPct >= 80
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          : overallPct >= 40
            ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
            : "border-red-500/20 bg-red-500/10 text-red-500"
      )}
    >
      <ActivityIcon className="size-3" />
      Overall readiness: {overallPct}%
    </div>
  )
}

function ReadinessSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[84px] w-full rounded-lg" />
      ))}
    </div>
  )
}

// ── Panel composition ────────────────────────────────────────────────────

export function DashboardPanels({
  snapshot,
  health,
  isLoading,
  isHealthLoading,
}: {
  snapshot: DashboardSnapshot | null
  health: SystemHealthResponse | null
  isLoading: boolean
  isHealthLoading: boolean
}) {
  const stats = snapshot?.stats
  const services = health?.services || []

  const readinessItems: ReadinessItem[] = stats
    ? [
        {
          label: "Stops mapped",
          description: "Routes with ordered stop data",
          value: stats.routes_with_stops,
          total: stats.total_routes,
          icon: MapPinIcon,
        },
        {
          label: "Polylines ready",
          description: "Geometry ready for map rendering",
          value: stats.routes_with_polyline,
          total: stats.total_routes,
          icon: RouteIcon,
        },
        {
          label: "Timetables published",
          description: "Schedule entries attached",
          value: stats.routes_with_timetable,
          total: stats.total_routes,
          icon: CalendarClockIcon,
        },
      ]
    : []

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @6xl/main:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Service Health</CardTitle>
              <CardDescription>
                Live dependency checks for the backend.
              </CardDescription>
            </div>
            {!isHealthLoading && services.length > 0 && (
              <OverallHealthBadge services={services} />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isHealthLoading ? (
            <HealthSkeleton />
          ) : services.length > 0 ? (
            <>
              {services
                .filter((s) => s.status !== "not_running")
                .map((service) => (
                  <HealthRow key={service.name} service={service} />
                ))}
              {health?.checked_at && (
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  Last checked{" "}
                  {new Date(health.checked_at).toLocaleTimeString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Service health data is not available yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Route Readiness</CardTitle>
              <CardDescription>
                Coverage snapshot from the current dataset.
              </CardDescription>
            </div>
            {!isLoading && readinessItems.length > 0 && (
              <OverallReadinessBadge items={readinessItems} />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading ? (
            <ReadinessSkeleton />
          ) : readinessItems.length > 0 ? (
            readinessItems.map((item) => (
              <ReadinessRow key={item.label} item={item} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Route readiness data is not available yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
