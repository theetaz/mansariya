import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RiBusLine, RiSignalWifiLine, RiSpeedLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Map, MapMarker, MarkerContent, MarkerTooltip, MapControls } from '@/components/ui/map';
import { fetchActiveBuses } from '@/lib/api-functions';
import type { Vehicle } from '@/lib/types';

export const Route = createFileRoute('/live-map')({
  component: LiveMapPage,
});

function LiveMapPage() {
  const { data: busData, isLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: fetchActiveBuses,
    refetchInterval: 5_000,
  });

  const buses: Vehicle[] = busData?.buses ?? [];
  const busCount = busData?.count ?? 0;

  const busesByRoute: Record<string, Vehicle[]> = {};
  buses.forEach((bus) => {
    if (!busesByRoute[bus.route_id]) busesByRoute[bus.route_id] = [];
    busesByRoute[bus.route_id].push(bus);
  });

  const sortedRoutes = Object.entries(busesByRoute).sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative">
        <Map center={[79.8612, 6.9271]} zoom={10}>
          <MapControls showZoom showLocate showFullscreen />
          {buses.map((b) => {
            const color = b.confidence === 'verified' ? '#22c55e' : b.confidence === 'good' ? '#f59e0b' : '#ef4444';
            return (
              <MapMarker key={b.virtual_id} longitude={b.lng} latitude={b.lat}>
                <MarkerContent>
                  <div className="size-4 rounded border-2 border-white shadow-md" style={{ background: color }} />
                </MarkerContent>
                <MarkerTooltip>
                  <div>Bus {b.virtual_id}</div>
                  <div>Route: {b.route_id} · {b.speed_kmh.toFixed(0)} km/h</div>
                </MarkerTooltip>
              </MapMarker>
            );
          })}
        </Map>

        {/* Floating stats */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg border p-3 shadow-lg z-10">
          <div className="flex items-center gap-2">
            <RiBusLine className="size-4 text-primary" />
            <span className="font-semibold tabular-nums">{busCount}</span>
            <span className="text-sm text-muted-foreground">active buses</span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l flex flex-col bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Live Tracking</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time bus positions
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b">
          <MiniStat icon={RiBusLine} label="Buses" value={busCount} loading={isLoading} />
          <MiniStat icon={RiSignalWifiLine} label="Routes" value={Object.keys(busesByRoute).length} loading={isLoading} />
        </div>

        {/* Bus list by route */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedRoutes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No active buses
            </div>
          ) : (
            sortedRoutes.map(([routeId, routeBuses]: [string, Vehicle[]]) => (
              <div key={routeId}>
                <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
                  <span className="text-sm font-medium">Route {routeId}</span>
                  <Badge variant="secondary" className="text-xs">
                    {routeBuses.length} bus{routeBuses.length > 1 ? 'es' : ''}
                  </Badge>
                </div>
                {routeBuses.map((bus: Vehicle) => (
                  <div key={bus.virtual_id} className="px-4 py-2 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{bus.virtual_id}</span>
                      <Badge
                        variant={bus.confidence === 'verified' ? 'default' : bus.confidence === 'good' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {bus.confidence}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RiSpeedLine className="size-3" />
                        {bus.speed_kmh.toFixed(0)} km/h
                      </span>
                      <span>{bus.contributor_count} contributor{bus.contributor_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
                <Separator />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            {loading ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <p className="font-semibold tabular-nums">{value}</p>
            )}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
