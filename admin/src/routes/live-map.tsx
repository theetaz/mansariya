import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  RiTimeLine,
  RiPinDistanceLine,
  RiNavigationLine,
  RiGroupLine,
  RiCompassLine,
} from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Map, MapRoute, MapMarker, MarkerContent, MarkerTooltip, MapControls, useMap } from '@/components/ui/map';
import { AnimatedBusMarker } from '@/components/animated-bus-marker';
import { fetchActiveBuses, fetchAdminRoutes, fetchAdminRouteDetail } from '@/lib/api-functions';
import type { Vehicle, AdminRouteWithStats, AdminEnrichedStop } from '@/lib/types';

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

          {/* Route polylines + stops */}
          {selectedRoutes.map((routeId) => (
            <RouteOverlay key={routeId} routeId={routeId} color={getRouteColor(routeId)} />
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

        {/* Selected bus detail overlay */}
        {selectedBus && (
          <BusDetailOverlay bus={selectedBus} onClose={() => setSelectedBusId(null)} />
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
          <span className="text-xs font-medium text-muted-foreground">ROUTE OVERLAYS</span>
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
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : sortedRoutes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No active buses</div>
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
                              : <RiEyeLine className="size-3.5 text-muted-foreground" />}
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

// ── Route Overlay: polyline + stop markers ──
function RouteOverlay({ routeId, color }: { routeId: string; color: string }) {
  const { data } = useQuery({
    queryKey: ['admin-route-detail', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
    staleTime: 5 * 60 * 1000,
  });

  const polyline = data?.polyline ?? [];
  const stops = data?.stops ?? [];

  return (
    <>
      {polyline.length >= 2 && <MapRoute coordinates={polyline} color={color} width={4} />}
      {stops.map((s, i) => (
        <MapMarker key={`${routeId}-${s.stop_id}`} longitude={s.lng} latitude={s.lat}>
          <MarkerContent>
            <div
              className="flex items-center justify-center size-5 rounded-full border-2 border-white shadow text-[8px] font-bold text-white"
              style={{ background: i === 0 ? '#22c55e' : i === stops.length - 1 ? '#ef4444' : color }}
            >
              {i + 1}
            </div>
          </MarkerContent>
          <MarkerTooltip>{s.name_en}</MarkerTooltip>
        </MapMarker>
      ))}
    </>
  );
}

// ── Bus Detail Overlay with ETAs ──
function BusDetailOverlay({ bus, onClose }: { bus: Vehicle; onClose: () => void }) {
  const { data: routeData } = useQuery({
    queryKey: ['admin-route-detail', bus.route_id],
    queryFn: () => fetchAdminRouteDetail(bus.route_id),
    staleTime: 5 * 60 * 1000,
  });

  const eta = useMemo(() => {
    if (!routeData?.stops?.length || !routeData?.polyline?.length) return null;
    return computeETAs(bus, routeData.stops, routeData.polyline);
  }, [bus, routeData]);

  return (
    <div className="absolute bottom-4 left-4 right-[21rem] bg-card/95 backdrop-blur rounded-lg border shadow-lg z-10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <RiBusLine className="size-5 text-primary" />
          <span className="font-semibold text-sm">{bus.virtual_id}</span>
          <Badge variant={bus.confidence === 'verified' ? 'default' : bus.confidence === 'good' ? 'secondary' : 'outline'} className="text-xs">
            {bus.confidence}
          </Badge>
          <Badge variant="outline" className="text-xs">Route {bus.route_id}</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="size-7 p-0">
          <RiCloseLine className="size-4" />
        </Button>
      </div>

      {/* Trip Progress */}
      {eta && eta.stops.length > 0 && (
        <div className="px-4 py-3 border-b">
          <TripProgress stops={eta.stops} progressPercent={eta.progressPercent} />
        </div>
      )}

      {/* Stats grid */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <InfoItem icon={RiSpeedLine} label="Speed" value={`${bus.speed_kmh.toFixed(1)} km/h`} />
          <InfoItem icon={RiCompassLine} label="Bearing" value={`${bus.bearing.toFixed(0)}° ${bearingToCardinal(bus.bearing)}`} />
          <InfoItem icon={RiGroupLine} label="Devices" value={`${bus.contributor_count}`} />

          {eta && (
            <>
              <InfoItem icon={RiNavigationLine} label="Next Stop" value={eta.nextStopName ?? 'N/A'} />
              <InfoItem icon={RiPinDistanceLine} label="Dist to Next" value={eta.distToNextStop ?? 'N/A'} />
              <InfoItem icon={RiTimeLine} label="ETA Next Stop" value={eta.etaNextStop ?? 'N/A'} highlight />
              <InfoItem icon={RiPinDistanceLine} label="Dist to End" value={eta.distToEnd ?? 'N/A'} />
              <InfoItem icon={RiTimeLine} label="ETA Terminal" value={eta.etaEnd ?? 'N/A'} highlight />
              <InfoItem icon={RiTimeLine} label="Est. Arrival" value={eta.arrivalTime ?? 'N/A'} highlight />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Trip Progress Bar ──
function TripProgress({ stops, progressPercent }: {
  stops: { name: string; passed: boolean; isCurrent: boolean }[];
  progressPercent: number;
}) {
  const passed = stops.filter((s) => s.passed).length;
  const currentStop = stops.find((s) => s.isCurrent);
  const firstName = stops[0]?.name ?? '';
  const lastName = stops[stops.length - 1]?.name ?? '';

  return (
    <div className="space-y-2">
      {/* Route endpoints + progress text */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-medium truncate max-w-[120px]">{firstName}</span>
        <span className="text-muted-foreground">{passed}/{stops.length} stops · {Math.round(progressPercent)}%</span>
        <span className="text-muted-foreground font-medium truncate max-w-[120px] text-right">{lastName}</span>
      </div>

      {/* Progress track */}
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-muted rounded-full" />

        {/* Filled track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Stop dots */}
        {stops.map((stop, i) => {
          const pct = stops.length <= 1 ? 0 : (i / (stops.length - 1)) * 100;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${pct}%` }}
            >
              <div className={`rounded-full transition-all ${
                stop.isCurrent
                  ? 'size-3 bg-primary ring-[3px] ring-primary/25'
                  : stop.passed
                    ? 'size-2 bg-primary'
                    : 'size-2 bg-muted-foreground/30'
              }`} />
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20">
                <div className="bg-foreground text-background text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {stop.name}
                </div>
              </div>
            </div>
          );
        })}

        {/* Bus indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-1000"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="size-5 rounded-full bg-primary border-[2.5px] border-background shadow-lg flex items-center justify-center">
            <RiBusLine className="size-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* Current stop label */}
      {currentStop && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <RiNavigationLine className="size-3 text-primary" />
          <span className="text-muted-foreground">Next:</span>
          <span className="text-primary font-medium">{currentStop.name}</span>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, mono, highlight }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`size-3.5 mt-0.5 shrink-0 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium leading-tight truncate ${mono ? 'font-mono' : ''} ${highlight ? 'text-primary' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

// ── ETA Computation ──
interface ETAResult {
  nextStopName: string;
  distToNextStop: string;
  etaNextStop: string;
  distToEnd: string;
  etaEnd: string;
  stopsPassed: string;
  stopsRemaining: string;
  arrivalTime: string;
  nextStopIdx: number;
  totalStops: number;
  progressPercent: number;
  stops: { name: string; passed: boolean; isCurrent: boolean }[];
}

function computeETAs(bus: Vehicle, stops: AdminEnrichedStop[], polyline: [number, number][]): ETAResult | null {
  if (stops.length === 0) return null;

  // Find nearest stop to bus current position
  let minDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < stops.length; i++) {
    const d = haversineKM(bus.lat, bus.lng, stops[i].lat, stops[i].lng);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  // Determine if bus has passed the nearest stop (check next stop is further ahead)
  let nextStopIdx = nearestIdx;
  if (nearestIdx < stops.length - 1) {
    const dToNearest = haversineKM(bus.lat, bus.lng, stops[nearestIdx].lat, stops[nearestIdx].lng);
    const dToNext = haversineKM(bus.lat, bus.lng, stops[nearestIdx + 1].lat, stops[nearestIdx + 1].lng);
    // If we're closer to the nearest than to the gap between nearest and next, we've likely passed it
    const gapDist = haversineKM(stops[nearestIdx].lat, stops[nearestIdx].lng, stops[nearestIdx + 1].lat, stops[nearestIdx + 1].lng);
    if (dToNearest < gapDist * 0.3) {
      nextStopIdx = nearestIdx + 1;
    }
  }

  // Ensure nextStopIdx is valid and ahead
  if (nextStopIdx >= stops.length) nextStopIdx = stops.length - 1;

  const nextStop = stops[nextStopIdx];
  const lastStop = stops[stops.length - 1];

  const distToNext = haversineKM(bus.lat, bus.lng, nextStop.lat, nextStop.lng);
  const distToEnd = haversineKM(bus.lat, bus.lng, lastStop.lat, lastStop.lng);

  // Use route distance if available, otherwise haversine
  const routeDistToEnd = lastStop.distance_from_start_km - (nextStop.distance_from_start_km - distToNext);

  const speedKMH = Math.max(bus.speed_kmh, 5); // min 5 km/h to avoid infinite ETA
  const etaNextMin = (distToNext / speedKMH) * 60;
  const etaEndMin = ((routeDistToEnd > 0 ? routeDistToEnd : distToEnd) / speedKMH) * 60;

  const arrivalDate = new Date(Date.now() + etaEndMin * 60 * 1000);
  const arrivalTime = arrivalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Build stop progress list
  const stopProgress = stops.map((s, i) => ({
    name: s.name_en,
    passed: i < nextStopIdx,
    isCurrent: i === nextStopIdx,
  }));

  // Progress percent — use stop index as primary, distance as fine-tuning
  const totalRouteDist = lastStop.distance_from_start_km;
  let progressPercent: number;
  if (totalRouteDist > 0) {
    const currentDist = Math.max(0, nextStop.distance_from_start_km - distToNext);
    progressPercent = Math.max(0, Math.min(100, (currentDist / totalRouteDist) * 100));
  } else {
    // Fallback: use stop index ratio
    progressPercent = Math.max(0, Math.min(100, (nextStopIdx / Math.max(stops.length - 1, 1)) * 100));
  }

  return {
    nextStopName: nextStop.name_en,
    distToNextStop: formatDist(distToNext),
    etaNextStop: formatETA(etaNextMin),
    distToEnd: formatDist(routeDistToEnd > 0 ? routeDistToEnd : distToEnd),
    etaEnd: formatETA(etaEndMin),
    stopsPassed: `${nextStopIdx} / ${stops.length}`,
    stopsRemaining: `${stops.length - nextStopIdx}`,
    arrivalTime,
    nextStopIdx,
    totalStops: stops.length,
    progressPercent,
    stops: stopProgress,
  };
}

function haversineKM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatETA(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function bearingToCardinal(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

// ── Smooth pan to selected bus ──
function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const { map } = useMap();
  const lastPan = useRef({ lat: 0, lng: 0 });

  useEffect(() => {
    if (!map) return;
    const dist = Math.abs(lat - lastPan.current.lat) + Math.abs(lng - lastPan.current.lng);
    if (dist > 0.001) {
      map.panTo([lng, lat], { duration: 500 });
      lastPan.current = { lat, lng };
    }
  }, [map, lat, lng]);

  return null;
}

function MiniStat({ icon: Icon, label, value, loading }: {
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
            {loading ? <Skeleton className="h-5 w-8" /> : <p className="font-semibold tabular-nums">{value}</p>}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
