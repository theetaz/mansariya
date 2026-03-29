import * as React from 'react';
import { RiDeleteBinLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SimulationVehicleInput } from '@/lib/types';

interface Props {
  index: number;
  vehicle: SimulationVehicleInput;
  onChange: (index: number, vehicle: SimulationVehicleInput) => void;
  onRemove: (index: number) => void;
  stops?: { id: string; name: string }[];
}

export function SimulationVehicleCard({ index, vehicle, onChange, onRemove, stops }: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const update = (patch: Partial<SimulationVehicleInput>) => {
    onChange(index, { ...vehicle, ...patch });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Bus {index + 1}</h4>
        <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>
          <RiDeleteBinLine className="size-4 text-red-500" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Vehicle ID</Label>
          <Input
            value={vehicle.vehicle_id}
            onChange={(e) => update({ vehicle_id: e.target.value })}
            placeholder="NB-1234"
          />
        </div>
        <div>
          <Label className="text-xs">Passengers</Label>
          <Input
            type="number"
            min={1}
            value={vehicle.passenger_count}
            onChange={(e) => update({ passenger_count: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label className="text-xs">Start From</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={vehicle.start_stop_id ?? ''}
            onChange={(e) => update({ start_stop_id: e.target.value || null, start_lat: null, start_lng: null })}
          >
            <option value="">Beginning of route</option>
            {stops?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? <RiArrowUpSLine className="size-3" /> : <RiArrowDownSLine className="size-3" />}
        {showAdvanced ? 'Hide' : 'Override'} speed, dwell, ping interval
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
          <div>
            <Label className="text-xs">Speed Min (km/h)</Label>
            <Input
              type="number"
              value={vehicle.speed_min_kmh ?? ''}
              onChange={(e) => update({ speed_min_kmh: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
          <div>
            <Label className="text-xs">Speed Max (km/h)</Label>
            <Input
              type="number"
              value={vehicle.speed_max_kmh ?? ''}
              onChange={(e) => update({ speed_max_kmh: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
          <div>
            <Label className="text-xs">Ping Interval (sec)</Label>
            <Input
              type="number"
              value={vehicle.ping_interval_sec ?? ''}
              onChange={(e) => update({ ping_interval_sec: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
          <div>
            <Label className="text-xs">Dwell Min (sec)</Label>
            <Input
              type="number"
              value={vehicle.dwell_min_sec ?? ''}
              onChange={(e) => update({ dwell_min_sec: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
          <div>
            <Label className="text-xs">Dwell Max (sec)</Label>
            <Input
              type="number"
              value={vehicle.dwell_max_sec ?? ''}
              onChange={(e) => update({ dwell_max_sec: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
        </div>
      )}
    </div>
  );
}
