import * as React from 'react';
import { RiDeleteBinLine, RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
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
  const [stopOpen, setStopOpen] = React.useState(false);

  const update = (patch: Partial<SimulationVehicleInput>) => {
    onChange(index, { ...vehicle, ...patch });
  };

  const selectedStopName = vehicle.start_stop_id
    ? stops?.find((s) => s.id === vehicle.start_stop_id)?.name ?? 'Unknown stop'
    : 'Beginning of route';

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Bus {index + 1}</h4>
        <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>
          <RiDeleteBinLine className="size-4 text-red-500" />
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Vehicle ID</Label>
        <Input
          value={vehicle.vehicle_id}
          onChange={(e) => update({ vehicle_id: e.target.value })}
          placeholder="NB-1234"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Passengers</Label>
        <Input
          type="number"
          min={1}
          value={vehicle.passenger_count}
          onChange={(e) => update({ passenger_count: parseInt(e.target.value) || 1 })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Start From</Label>
        <Popover open={stopOpen} onOpenChange={setStopOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={stopOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">{selectedStopName}</span>
              <RiArrowDownSLine className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search stops..." />
              <CommandList>
                <CommandEmpty>No stops found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="beginning-of-route"
                    onSelect={() => {
                      update({ start_stop_id: null, start_lat: null, start_lng: null });
                      setStopOpen(false);
                    }}
                  >
                    <RiCheckLine className={cn('mr-2 size-4', !vehicle.start_stop_id ? 'opacity-100' : 'opacity-0')} />
                    Beginning of route
                  </CommandItem>
                  {stops?.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      onSelect={() => {
                        update({ start_stop_id: s.id, start_lat: null, start_lng: null });
                        setStopOpen(false);
                      }}
                    >
                      <RiCheckLine className={cn('mr-2 size-4', vehicle.start_stop_id === s.id ? 'opacity-100' : 'opacity-0')} />
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
        <div className="space-y-3 pt-2 border-t">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Speed Min (km/h)</Label>
              <Input
                type="number"
                value={vehicle.speed_min_kmh ?? ''}
                onChange={(e) => update({ speed_min_kmh: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Use default"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Speed Max (km/h)</Label>
              <Input
                type="number"
                value={vehicle.speed_max_kmh ?? ''}
                onChange={(e) => update({ speed_max_kmh: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Use default"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dwell Min (sec)</Label>
              <Input
                type="number"
                value={vehicle.dwell_min_sec ?? ''}
                onChange={(e) => update({ dwell_min_sec: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Use default"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dwell Max (sec)</Label>
              <Input
                type="number"
                value={vehicle.dwell_max_sec ?? ''}
                onChange={(e) => update({ dwell_max_sec: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Use default"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ping Interval (sec)</Label>
            <Input
              type="number"
              value={vehicle.ping_interval_sec ?? ''}
              onChange={(e) => update({ ping_interval_sec: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Use default"
            />
          </div>
        </div>
      )}
    </div>
  );
}
