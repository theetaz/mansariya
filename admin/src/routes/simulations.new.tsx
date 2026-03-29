import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RiAddLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimulationVehicleCard } from '@/components/simulation-vehicle-card';
import { createSimulation, fetchAdminRoutes, fetchAdminRouteDetail } from '@/lib/api-functions';
import type { SimulationJobInput, SimulationVehicleInput } from '@/lib/types';

export const Route = createFileRoute('/simulations/new')({
  component: NewSimulationPage,
});

function NewSimulationPage() {
  const navigate = useNavigate();
  const [name, setName] = React.useState('');
  const [routeId, setRouteId] = React.useState('');
  const [routeSearch, setRouteSearch] = React.useState('');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pingIntervalSec, setPingIntervalSec] = React.useState(3);
  const [speedMin, setSpeedMin] = React.useState(20);
  const [speedMax, setSpeedMax] = React.useState(60);
  const [dwellMin, setDwellMin] = React.useState(15);
  const [dwellMax, setDwellMax] = React.useState(60);
  const [vehicles, setVehicles] = React.useState<SimulationVehicleInput[]>([
    { vehicle_id: 'BUS-001', passenger_count: 3 },
  ]);

  const { data: routesData } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const { data: routeDetail } = useQuery({
    queryKey: ['admin-route-detail', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
    enabled: !!routeId,
  });

  const routes = routesData?.routes ?? [];
  const filteredRoutes = routeSearch
    ? routes.filter((r) =>
        r.name_en.toLowerCase().includes(routeSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(routeSearch.toLowerCase())
      )
    : routes;

  const stops = routeDetail?.stops?.map((s) => ({ id: s.stop_id, name: `${s.stop_order + 1}. ${s.name_en}` })) ?? [];

  const mutation = useMutation({
    mutationFn: createSimulation,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: SimulationJobInput = {
      route_id: routeId,
      name,
      ping_interval_sec: pingIntervalSec,
      default_speed_min_kmh: speedMin,
      default_speed_max_kmh: speedMax,
      default_dwell_min_sec: dwellMin,
      default_dwell_max_sec: dwellMax,
      vehicles,
    };
    mutation.mutate(input);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">New Simulation</h1>
        <p className="text-sm text-muted-foreground">Configure a simulation job with buses and parameters</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Simulation Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning Rush Test" required />
            </div>
            <div>
              <Label>Route</Label>
              <Input
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                placeholder="Search routes..."
              />
              {routeSearch && !routeId && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-sm">
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div>
              <h3 className="text-sm font-semibold">Advanced Configuration</h3>
              <p className="text-xs text-muted-foreground">Default speed, dwell time, ping interval</p>
            </div>
            {showAdvanced ? <RiArrowUpSLine className="size-4" /> : <RiArrowDownSLine className="size-4" />}
          </button>
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3">
              <div>
                <Label className="text-xs">Speed Min (km/h)</Label>
                <Input type="number" value={speedMin} onChange={(e) => setSpeedMin(parseFloat(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Speed Max (km/h)</Label>
                <Input type="number" value={speedMax} onChange={(e) => setSpeedMax(parseFloat(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Ping Interval (sec)</Label>
                <Input type="number" value={pingIntervalSec} onChange={(e) => setPingIntervalSec(parseInt(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Dwell Min (sec)</Label>
                <Input type="number" value={dwellMin} onChange={(e) => setDwellMin(parseInt(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Dwell Max (sec)</Label>
                <Input type="number" value={dwellMax} onChange={(e) => setDwellMax(parseInt(e.target.value))} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vehicles</h2>
            <Button type="button" size="sm" variant="secondary" onClick={addVehicle}>
              <RiAddLine className="mr-1 size-4" /> Add Bus
            </Button>
          </div>
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
          {vehicles.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Add at least one bus to create a simulation.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!name || !routeId || vehicles.length === 0 || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Simulation'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/simulations' })}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
