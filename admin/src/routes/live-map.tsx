import { useState, useCallback, useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  RiBusLine,
  RiSignalWifiLine,
  RiSpeedLine,
  RiSearchLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCheckLine,
  RiMapPinLine,
} from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Map, MapRoute, MapControls, useMap } from '@/components/ui/map';
import { AnimatedBusMarker } from '@/components/animated-bus-marker';
import { fetchActiveBuses, fetchAdminRoutes, fetchAdminRouteDetail } from '@/lib/api-functions';
import type { Vehicle, AdminRouteWithStats, AdminRouteDetail } from '@/lib/types';

export const Route = createFileRoute('/live-map')({
  component: LiveMapPage,
});

const ROUTE_COLORS = ['#1D9E75', '#378ADD', '#E24B4A', '#BA7517', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function LiveMapPage() {
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [hiddenBuses, setHiddenBuses] = useState<Set<string>>(new Set());
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [routeSearchOpen, setRouteSearchOpen] = useState(false);

  const { data: busData, isLoading } = useQuery({
    queryKey: ['active-buses'],
    queryFn: fetchActiveBuses,
    refetchInterval: 3_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const buses: Vehicle[] = busData?.buses ?? [];
  const busCount = busData?.count ?? 0;
  const allRoutes: AdminRouteWithStats[] = routesData?.routes ?? [];

  const busesByRoute: Record<string, Vehicle[]> = {};
  buses.forEach((bus) => {
    if (!busesByRoute[bus.route_id]) busesByRoute[bus.route_id] = [];
    busesByRoute[bus.route_id].push(bus);
  });

  const sortedRoutes = Object.entries(busesByRoute).sort(
    (a, b) => b[1].length - a[1].length,
  );

  const toggleBusVisibility = useCallback((busId: string) => {
    setHiddenBuses((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) next.delete(busId);
      else next.add(busId);
      return next;
    });
  }, []);

  const handleBusClick = useCallback((busId: string) => {
    setSelectedBusId((prev) => (prev === busId ? null : busId));
  }, []);

  const addRoute = useCallback((routeId: string) => {
    setSelectedRoutes((prev) => (prev.includes(routeId) ? prev : [...prev, routeId]));
    setRouteSearchOpen(false);
  }, []);

  const removeRoute = useCallback((routeId: string) => {
    setSelectedRoutes((prev) => prev.filter((r) => r !== routeId));
  }, []);

  const getRouteColor = (routeId: string) => {
    const idx = selectedRoutes.indexOf(routeId);
    return ROUTE_COLORS[idx % ROUTE_COLORS.length];
  };

  const selectedBus = selectedBusId ? buses.find((b) => b.virtual_id === selectedBusId) : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative">
        <Map center={[79.8612, 6.9271]} zoom={10}>
          <MapControls showZoom showLocate showFullscreen />

          {/* Route polylines */}
          {selectedRoutes.map((routeId) => (
            <RoutePolyline key={routeId} routeId={routeId} color={getRouteColor(routeId)} />
          ))}

          {/* Bus markers */}
          {buses.map((b) => (
            <AnimatedBusMarker
              key={b.virtual_id}
              id={b.virtual_id}
              lat={b.lat}
              lng={b.lng}
              bearing={b.bearing}
              confidence={b.confidence}
              visible={!hiddenBuses.has(b.virtual_id)}
              selected={selectedBusId === b.virtual_id}
              onClick={() => handleBusClick(b.virtual_id)}
              tooltip={`Route ${b.route_id} · ${b.speed_kmh.toFixed(0)} km/h · ${b.contributor_count} device${b.contributor_count > 1 ? 's' : ''}`}
            />
          ))}

          {/* Pan to selected bus */}
          {selectedBus && <PanTo lat={selectedBus.lat} lng={selectedBus.lng} />}
        </Map>

        {/* Floating stats */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg border p-3 shadow-lg z-10">
          <div className="flex items-center gap-2">
            <RiBusLine className="size-4 text-primary" />
            <span className="font-semibold tabular-nums">{busCount}</span>
            <span className="text-sm text-muted-foreground">active buses</span>
          </div>
        </div>

        {/* Selected bus overlay */}
        {selectedBus && (
          <div className="absolute bottom-4 left-4 right-80 bg-card/95 backdrop-blur rounded-lg border shadow-lg z-10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RiBusLine className="size-5 text-primary" />
                <span className="font-semibold">{selectedBus.virtual_id}</span>
                <Badge variant={selectedBus.confidence === 'verified' ? 'default' : selectedBus.confidence === 'good' ? 'secondary' : 'outline'}>
                  {selectedBus.confidence}
                </Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedBusId(null)}>
                <RiCloseLine className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="font-semibold">{selectedBus.route_id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Speed</p>
                <p className="font-semibold tabular-nums">{selectedBus.speed_kmh.toFixed(1)} km/h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bearing</p>
                <p className="font-semibold tabular-nums">{selectedBus.bearing.toFixed(0)}°</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Devices</p>
                <p className="font-semibold tabular-nums">{selectedBus.contributor_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="font-mono text-xs tabular-nums">{selectedBus.lat.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="font-mono text-xs tabular-nums">{selectedBus.lng.toFixed(6)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l flex flex-col bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Live Tracking</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time bus positions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b">
          <MiniStat icon={RiBusLine} label="Buses" value={busCount} loading={isLoading} />
          <MiniStat icon={RiSignalWifiLine} label="Routes" value={Object.keys(busesByRoute).length} loading={isLoading} />
        </div>

        {/* Route filter */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">ROUTE OVERLAYS</span>
          </div>
          <Popover open={routeSearchOpen} onOpenChange={setRouteSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-muted-foreground font-normal">
                <RiSearchLine className="size-3.5" />
                Add route overlay...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search routes..." />
                <CommandList>
                  <CommandEmpty>No routes found.</CommandEmpty>
                  <CommandGroup>
                    {allRoutes.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`${r.id} ${r.name_en}`}
                        onSelect={() => addRoute(r.id)}
                        disabled={selectedRoutes.includes(r.id)}
                      >
                        <RiCheckLine className={`mr-2 size-4 ${selectedRoutes.includes(r.id) ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="font-medium">{r.id}</span>
                        <span className="ml-1 truncate text-muted-foreground">— {r.name_en}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedRoutes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedRoutes.map((routeId) => (
                <Badge key={routeId} variant="secondary" className="gap-1 pr-1">
                  <div className="size-2 rounded-full" style={{ background: getRouteColor(routeId) }} />
                  {routeId}
                  <button onClick={() => removeRoute(routeId)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                    <RiCloseLine className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Bus list */}
        <ScrollArea className="flex-1">
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
            sortedRoutes.map(([routeId, routeBuses]) => (
              <div key={routeId}>
                <div className="px-4 py-2 bg-muted/50 flex items-center justify-between sticky top-0 z-10">
                  <span className="text-sm font-medium">Route {routeId}</span>
                  <Badge variant="secondary" className="text-xs">
                    {routeBuses.length} bus{routeBuses.length > 1 ? 'es' : ''}
                  </Badge>
                </div>
                {routeBuses.map((bus) => {
                  const isSelected = selectedBusId === bus.virtual_id;
                  const isHidden = hiddenBuses.has(bus.virtual_id);
                  return (
                    <div
                      key={bus.virtual_id}
                      className={`px-4 py-2.5 border-b last:border-b-0 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => handleBusClick(bus.virtual_id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{bus.virtual_id}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-6 p-0"
                            onClick={(e) => { e.stopPropagation(); toggleBusVisibility(bus.virtual_id); }}
                            title={isHidden ? 'Show on map' : 'Hide from map'}
                          >
                            {isHidden
                              ? <RiEyeOffLine className="size-3.5 text-muted-foreground" />
                              : <RiEyeLine className="size-3.5 text-muted-foreground" />
                            }
                          </Button>
                          <Badge
                            variant={bus.confidence === 'verified' ? 'default' : bus.confidence === 'good' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {bus.confidence}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <RiSpeedLine className="size-3" />
                          {bus.speed_kmh.toFixed(0)} km/h
                        </span>
                        <span>{bus.contributor_count} contributor{bus.contributor_count > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  );
                })}
                <Separator />
              </div>
            ))
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// Fetches and renders route polyline
function RoutePolyline({ routeId, color }: { routeId: string; color: string }) {
  const { data } = useQuery({
    queryKey: ['admin-route-detail', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
    staleTime: 5 * 60 * 1000,
  });

  const polyline = data?.polyline ?? [];
  if (polyline.length < 2) return null;

  return <MapRoute coordinates={polyline} color={color} width={4} />;
}

// Smoothly pans map to selected bus
function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const { map } = useMap();
  const lastPan = useRef({ lat: 0, lng: 0 });

  useEffect(() => {
    if (!map) return;
    // Only pan if bus moved significantly (avoid jitter on every update)
    const dist = Math.abs(lat - lastPan.current.lat) + Math.abs(lng - lastPan.current.lng);
    if (dist > 0.001) {
      map.panTo([lng, lat], { duration: 500 });
      lastPan.current = { lat, lng };
    }
  }, [map, lat, lng]);

  return null;
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
