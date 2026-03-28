import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as RouteIcon, Bus, Activity, Clock, Database } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchRoutes, fetchActiveBuses, fetchMetrics } from '@/lib/api';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string | number;
  icon: typeof RouteIcon;
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {loading ? <Skeleton className="h-8 w-24" /> : value}
        </CardTitle>
        <CardAction>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      {description && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">{description}</div>
        </CardFooter>
      )}
    </Card>
  );
}

function DashboardPage() {
  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => fetchRoutes(),
    staleTime: 60_000,
  });

  const { data: busData, isLoading: busesLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: () => fetchActiveBuses(),
    refetchInterval: 15_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchMetrics(),
    refetchInterval: 30_000,
    retry: 1,
  });

  const routes = routeData?.routes ?? [];
  const routeCount = routeData?.count ?? 0;
  const busCount = busData?.count ?? 0;

  const withStops = routes.filter((r) => r.polyline && r.polyline.length > 0).length;
  const withNames = routes.filter((r) => r.name_en).length;
  const operators = new Map<string, number>();
  routes.forEach((r) => {
    const op = r.operator || 'Unknown';
    operators.set(op, (operators.get(op) ?? 0) + 1);
  });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Mansariya bus tracking platform overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <StatCard
          title="Total Routes"
          value={routeCount}
          icon={RouteIcon}
          description={`${withNames} with names`}
          loading={routesLoading}
        />
        <StatCard
          title="Active Buses"
          value={busCount}
          icon={Bus}
          description="Currently tracked"
          loading={busesLoading}
        />
        <StatCard
          title="GPS Pipeline"
          value={metrics?.stream_gps_raw ?? 0}
          icon={Activity}
          description="Items in raw stream"
          loading={metricsLoading}
        />
        <StatCard
          title="Uptime"
          value={metrics?.uptime_human ?? '—'}
          icon={Clock}
          description={`${metrics?.goroutines ?? 0} goroutines`}
          loading={metricsLoading}
        />
      </div>

      {/* Data Quality + System Info */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <QualityBar label="With English name" value={withNames} total={routeCount} />
                <QualityBar label="With polyline" value={withStops} total={routeCount} />
                <QualityBar
                  label="By operator"
                  value={0}
                  total={0}
                  custom={
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from(operators.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([op, count]) => (
                          <Badge key={op} variant="secondary" className="text-xs">
                            {op}: {count}
                          </Badge>
                        ))}
                    </div>
                  }
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metricsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : metrics ? (
              <>
                <SystemRow label="Memory" value={`${(metrics.memory_alloc_mb).toFixed(1)} MB`} />
                <SystemRow label="Goroutines" value={String(metrics.goroutines)} />
                <SystemRow label="GC Runs" value={String(metrics.gc_runs)} />
                <SystemRow
                  label="Redis"
                  value={metrics.redis_connected ? 'Connected' : 'Disconnected'}
                  status={metrics.redis_connected ? 'green' : 'red'}
                />
                <SystemRow label="GPS Raw Stream" value={String(metrics.stream_gps_raw)} />
                <SystemRow label="GPS Matched Stream" value={String(metrics.stream_gps_matched)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Backend not reachable</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualityBar({
  label,
  value,
  total,
  custom,
}: {
  label: string;
  value: number;
  total: number;
  custom?: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        {!custom && <span className="text-muted-foreground">{value}/{total} ({pct}%)</span>}
      </div>
      {custom ?? (
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SystemRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'green' | 'red';
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={status === 'green' ? 'text-green-500' : status === 'red' ? 'text-red-500' : ''}>
        {value}
      </span>
    </div>
  );
}
