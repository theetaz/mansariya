import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bus,
  Activity,
  Radio,
  Clock,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchActiveBuses, fetchMetrics, type Vehicle, type Metrics } from '@/lib/api';

export const Route = createFileRoute('/live-map')({
  component: LiveMapPage,
});

function LiveMapPage() {
  const { data: busData, isLoading: busesLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: () => fetchActiveBuses(),
    refetchInterval: 5_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchMetrics(),
    refetchInterval: 5_000,
    retry: 1,
  });

  const buses: Vehicle[] = busData?.buses ?? [];
  const busCount = busData?.count ?? 0;

  // Group buses by route
  const busesByRoute = new Map<string, Vehicle[]>();
  buses.forEach((bus) => {
    const routeId = bus.route_id || 'unknown';
    const group = busesByRoute.get(routeId) ?? [];
    group.push(bus);
    busesByRoute.set(routeId, group);
  });

  const sortedRoutes = Array.from(busesByRoute.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative bg-muted/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Radio className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium text-muted-foreground">Map View</p>
              <p className="text-sm text-muted-foreground/70">
                MapLibre GL will be initialized here
              </p>
            </div>
            {busCount > 0 && (
              <Badge variant="default" className="text-sm">
                {busCount} active buses to display
              </Badge>
            )}
          </div>
        </div>

        {/* Floating status indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 shadow-sm border">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-medium">Live — refreshing every 5s</span>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l bg-background flex flex-col">
        {/* Active Bus Count Card */}
        <div className="p-4 border-b">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Buses</CardTitle>
              <Bus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {busesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{busCount}</div>
                  <p className="text-xs text-muted-foreground">
                    across {busesByRoute.size} routes
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Metrics */}
        <div className="p-4 border-b space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            System Metrics
          </h3>
          {metricsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : metrics ? (
            <MetricsPanel metrics={metrics} />
          ) : (
            <p className="text-xs text-muted-foreground">Backend not reachable</p>
          )}
        </div>

        {/* Active Buses by Route */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Bus className="h-3.5 w-3.5" />
              Buses by Route
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {busesLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : sortedRoutes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bus className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No active buses</p>
                </div>
              ) : (
                sortedRoutes.map(([routeId, routeBuses]) => (
                  <RouteGroup
                    key={routeId}
                    routeId={routeId}
                    buses={routeBuses}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricItem
        icon={<Clock className="h-3 w-3" />}
        label="Uptime"
        value={metrics.uptime_human}
      />
      <MetricItem
        icon={<Activity className="h-3 w-3" />}
        label="Goroutines"
        value={String(metrics.goroutines)}
      />
      <MetricItem
        icon={<Radio className="h-3 w-3" />}
        label="GPS Raw"
        value={String(metrics.stream_gps_raw)}
      />
      <MetricItem
        icon={<Radio className="h-3 w-3" />}
        label="GPS Matched"
        value={String(metrics.stream_gps_matched)}
      />
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function RouteGroup({ routeId, buses }: { routeId: string; buses: Vehicle[] }) {
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {routeId}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {buses.length} {buses.length === 1 ? 'bus' : 'buses'}
          </span>
        </div>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="ml-2 space-y-0.5">
        {buses.map((bus) => (
          <BusItem key={bus.virtual_id} bus={bus} />
        ))}
      </div>
      <Separator className="my-1" />
    </div>
  );
}

function BusItem({ bus }: { bus: Vehicle }) {
  const confidenceColor = {
    low: 'text-amber-500',
    good: 'text-green-500',
    verified: 'text-blue-500',
  }[bus.confidence] ?? 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-muted/30">
      <div className="flex items-center gap-2">
        <Bus className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono">{bus.virtual_id.slice(0, 8)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          {bus.speed_kmh.toFixed(0)} km/h
        </span>
        <div className="flex items-center gap-0.5">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span>{bus.contributor_count}</span>
        </div>
        <span className={confidenceColor}>{bus.confidence}</span>
      </div>
    </div>
  );
}
