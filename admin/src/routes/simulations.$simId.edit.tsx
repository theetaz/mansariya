import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiSaveLine,
  RiSearchLine,
  RiBusLine,
  RiSettings3Line,
} from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Map,
  useMap,
  MapRoute,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapControls,
} from '@/components/ui/map';
import { SimulationVehicleCard } from '@/components/simulation-vehicle-card';
import { fetchSimulation, updateSimulation, fetchAdminRoutes, fetchAdminRouteDetail } from '@/lib/api-functions';
import type { SimulationJobInput, SimulationVehicleInput } from '@/lib/types';

export const Route = createFileRoute('/simulations/$simId/edit')({
  component: EditSimulationPage,
});

function EditSimulationPage() {
  const { simId } = Route.useParams();
  const navigate = useNavigate();
  const [initialized, setInitialized] = React.useState(false);
  const [name, setName] = React.useState('');
  const [routeId, setRouteId] = React.useState('');
  const [routeSearch, setRouteSearch] = React.useState('');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pingIntervalSec, setPingIntervalSec] = React.useState(3);
  const [speedMin, setSpeedMin] = React.useState(20);
  const [speedMax, setSpeedMax] = React.useState(60);
  const [dwellMin, setDwellMin] = React.useState(15);
  const [dwellMax, setDwellMax] = React.useState(60);
  const [vehicles, setVehicles] = React.useState<SimulationVehicleInput[]>([]);

  const { data: simData } = useQuery({
    queryKey: ['simulation', simId],
    queryFn: () => fetchSimulation(simId),
  });

  const { data: routesData } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const { data: routeDetail } = useQuery({
    queryKey: ['admin-route-detail', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
    enabled: !!routeId,
  });

  React.useEffect(() => {
    if (simData && !initialized) {
      const j = simData.job;
      setName(j.name);
      setRouteId(j.route_id);
      setRouteSearch(`${j.route_id} — ${j.route_name ?? ''}`);
      setPingIntervalSec(j.ping_interval_sec);
      setSpeedMin(j.default_speed_min_kmh);
      setSpeedMax(j.default_speed_max_kmh);
      setDwellMin(j.default_dwell_min_sec);
      setDwellMax(j.default_dwell_max_sec);
      setVehicles(simData.vehicles.map((v) => ({
        vehicle_id: v.vehicle_id,
        passenger_count: v.passenger_count,
        speed_min_kmh: v.speed_min_kmh,
        speed_max_kmh: v.speed_max_kmh,
        dwell_min_sec: v.dwell_min_sec,
        dwell_max_sec: v.dwell_max_sec,
        start_stop_id: v.start_stop_id,
        start_lat: v.start_lat,
        start_lng: v.start_lng,
        ping_interval_sec: v.ping_interval_sec,
      })));
      setInitialized(true);
    }
  }, [simData, initialized]);

  const routes = routesData?.routes ?? [];
  const filteredRoutes = routeSearch
    ? routes.filter((r) =>
        r.name_en.toLowerCase().includes(routeSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(routeSearch.toLowerCase())
      )
    : routes;

  const stops = routeDetail?.stops?.map((s) => ({
    id: s.stop_id,
    name: `${s.stop_order + 1}. ${s.name_en}`,
    lat: s.lat,
    lng: s.lng,
  })) ?? [];

  const polyline = routeDetail?.polyline ?? [];

  const mutation = useMutation({
    mutationFn: (data: SimulationJobInput) => updateSimulation(simId, data),
    onSuccess: () => navigate({ to: '/simulations' }),
  });

  const addVehicle = () => {
    setVehicles([...vehicles, { vehicle_id: `BUS-${String(vehicles.length + 1).padStart(3, '0')}`, passenger_count: 3 }]);
  };

  const updateVehicle = (idx: number, v: SimulationVehicleInput) => {
    const next = [...vehicles];
    next[idx] = v;
    setVehicles(next);
  };

  const removeVehicle = (idx: number) => {
    setVehicles(vehicles.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    mutation.mutate({
      route_id: routeId,
      name,
      ping_interval_sec: pingIntervalSec,
      default_speed_min_kmh: speedMin,
      default_speed_max_kmh: speedMax,
      default_dwell_min_sec: dwellMin,
      default_dwell_max_sec: dwellMax,
      vehicles,
    });
  };

  if (!simData) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/simulations' })}>
          <RiArrowLeftLine className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Edit Simulation</h1>
          <p className="text-sm text-muted-foreground">Modify simulation configuration</p>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!name || !routeId || vehicles.length === 0 || mutation.isPending}
        >
          <RiSaveLine className="size-4 mr-1" />
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Two-column: Form + Map */}
      <div className="flex-1 flex gap-4 px-4 lg:px-6 min-h-0">
        {/* Left panel */}
        <div className="w-96 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Simulation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simulation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Rush Test"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Route *</Label>
                <div className="relative">
                  <RiSearchLine className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={routeSearch}
                    onChange={(e) => { setRouteSearch(e.target.value); if (routeId) setRouteId(''); }}
                    placeholder="Search routes..."
                  />
                </div>
                {routeSearch && !routeId && (
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-popover text-sm">
                    {filteredRoutes.slice(0, 10).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                        onClick={() => { setRouteId(r.id); setRouteSearch(`${r.id} — ${r.name_en}`); }}
                      >
                        <span className="font-medium">{r.id}</span> — {r.name_en}
                      </button>
                    ))}
                    {filteredRoutes.length === 0 && (
                      <div className="px-3 py-2 text-muted-foreground">No routes found</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Advanced Configuration */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RiSettings3Line className="size-4" />
                  Advanced Configuration
                </span>
                {showAdvanced ? <RiArrowUpSLine className="size-4" /> : <RiArrowDownSLine className="size-4" />}
              </CardTitle>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Speed Min (km/h)</Label>
                    <Input type="number" value={speedMin} onChange={(e) => setSpeedMin(parseFloat(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Speed Max (km/h)</Label>
                    <Input type="number" value={speedMax} onChange={(e) => setSpeedMax(parseFloat(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dwell Min (sec)</Label>
                    <Input type="number" value={dwellMin} onChange={(e) => setDwellMin(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dwell Max (sec)</Label>
                    <Input type="number" value={dwellMax} onChange={(e) => setDwellMax(parseInt(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ping Interval (sec)</Label>
                  <Input type="number" value={pingIntervalSec} onChange={(e) => setPingIntervalSec(parseInt(e.target.value))} />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Vehicles */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RiBusLine className="size-4" />
                  Vehicles
                  <Badge variant="secondary" className="text-xs">{vehicles.length}</Badge>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={addVehicle} className="gap-1">
                  <RiAddLine className="size-3.5" /> Add Bus
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <RiBusLine className="size-8 mx-auto mb-2 opacity-40" />
                  <p>No vehicles yet.</p>
                  <p className="text-xs mt-1">Add at least one bus.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map((v, i) => (
                    <SimulationVehicleCard
                      key={i}
                      index={i}
                      vehicle={v}
                      onChange={updateVehicle}
                      onRemove={removeVehicle}
                      stops={stops}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: Map */}
        <div className="flex-1 rounded-lg border overflow-hidden relative">
          <Map center={[79.8612, 7.0]} zoom={8}>
            <MapControls showZoom showLocate />
            <FitToPolyline polyline={polyline} />
            {polyline.length >= 2 && (
              <MapRoute coordinates={polyline} color="#1D9E75" width={4} />
            )}
            {stops.map((s, i) => (
              <MapMarker key={`${s.id}-${i}`} longitude={s.lng} latitude={s.lat}>
                <MarkerContent>
                  <div
                    className="flex items-center justify-center size-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold text-white"
                    style={{ background: i === 0 ? '#22c55e' : i === stops.length - 1 ? '#ef4444' : '#1D9E75' }}
                  >
                    {i + 1}
                  </div>
                </MarkerContent>
                <MarkerTooltip>{s.name}</MarkerTooltip>
              </MapMarker>
            ))}
          </Map>

          {routeId && stops.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur rounded-lg border px-3 py-1.5 text-xs text-muted-foreground shadow z-20">
              Route {routeId} · {stops.length} stops · {polyline.length} polyline points
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FitToPolyline({ polyline }: { polyline: [number, number][] }) {
  const { map } = useMap();
  const prevLength = React.useRef(0);

  React.useEffect(() => {
    if (!map || polyline.length < 2) return;
    if (polyline.length === prevLength.current) return;
    prevLength.current = polyline.length;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of polyline) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 50, duration: 1000 },
    );
  }, [map, polyline]);

  return null;
}
