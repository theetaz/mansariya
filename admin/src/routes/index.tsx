import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  RiRouteLine,
  RiMapPinLine,
  RiBusLine,
  RiTimeLine,
  RiDatabase2Line,
  RiPulseLine,
} from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
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
import { fetchAdminStats, fetchAdminRoutes, fetchActiveBuses, fetchHealth } from '@/lib/api-functions';

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
  icon: React.ComponentType<{ className?: string }>;
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
          <Icon className="size-4 text-muted-foreground" />
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
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    staleTime: 60_000,
  });

  const { data: busData, isLoading: busesLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: fetchActiveBuses,
    refetchInterval: 15_000,
  });

  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
    staleTime: 60_000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const routes = routeData?.routes ?? [];
  const operators = new Map<string, number>();
  routes.forEach((r) => {
    const op = r.operator || 'Unknown';
    operators.set(op, (operators.get(op) ?? 0) + 1);
  });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mansariya bus tracking platform overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <StatCard
          title="Total Routes"
          value={stats?.total_routes ?? 0}
          icon={RiRouteLine}
          description={`${stats?.active_routes ?? 0} active`}
          loading={statsLoading}
        />
        <StatCard
          title="Total Stops"
          value={stats?.total_stops ?? 0}
          icon={RiMapPinLine}
          description={`${stats?.routes_with_stops ?? 0} routes with stops`}
          loading={statsLoading}
        />
        <StatCard
          title="Active Buses"
          value={busData?.count ?? 0}
          icon={RiBusLine}
          description="Currently tracked"
          loading={busesLoading}
        />
        <StatCard
          title="Timetables"
          value={stats?.routes_with_timetable ?? 0}
          icon={RiTimeLine}
          description="Routes with schedules"
          loading={statsLoading}
        />
      </div>

      {/* Data Quality + System Health */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiDatabase2Line className="size-4" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <QualityBar
                  label="With polyline"
                  value={stats?.routes_with_polyline ?? 0}
                  total={stats?.total_routes ?? 0}
                />
                <QualityBar
                  label="With stops"
                  value={stats?.routes_with_stops ?? 0}
                  total={stats?.total_routes ?? 0}
                />
                <QualityBar
                  label="With timetable"
                  value={stats?.routes_with_timetable ?? 0}
                  total={stats?.total_routes ?? 0}
                />
                <div className="space-y-1 pt-1">
                  <span className="text-sm">By operator</span>
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiPulseLine className="size-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SystemRow
              label="Backend"
              value={health?.status === 'ok' ? 'Connected' : 'Unreachable'}
              status={health?.status === 'ok' ? 'green' : 'red'}
            />
            <SystemRow
              label="Active buses"
              value={String(busData?.count ?? 0)}
            />
            <SystemRow
              label="Total routes"
              value={String(stats?.total_routes ?? 0)}
            />
            <SystemRow
              label="Routes with data"
              value={`${stats?.routes_with_polyline ?? 0} polyline, ${stats?.routes_with_stops ?? 0} stops`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualityBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
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
