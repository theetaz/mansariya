import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  RiArrowLeftLine,
  RiSaveLine,
  RiMapPinAddLine,
  RiDeleteBinLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSearchLine,
  RiCloseLine,
  RiRouteLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationAutocomplete } from '@/components/shared/location-autocomplete';
import {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapRoute,
  MapControls,
} from '@/components/ui/map';
import { createRoute, createStop, setRouteStops, updatePolyline } from '@/lib/api-functions';
import { getRoute, reverseGeocode, type NominatimResult } from '@/lib/geo';

export const Route = createFileRoute('/routes/new')({
  component: NewRoutePage,
});

interface StopEntry {
  id: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  lat: number;
  lng: number;
  order: number;
}

function slugifyStopName(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii || 'stop';
}

function buildStopId(routeId: string, stopName: string, index: number): string {
  return `${routeId}-${String(index + 1).padStart(2, '0')}-${slugifyStopName(stopName).slice(0, 40)}`;
}

function NewRoutePage() {
  const navigate = useNavigate();

  // Route metadata
  const [routeId, setRouteId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameSi, setNameSi] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [operator, setOperator] = useState('Private');
  const [serviceType, setServiceType] = useState('Normal');
  const [fareLkr, setFareLkr] = useState(0);
  const [frequencyMin, setFrequencyMin] = useState(0);
  const [operatingHours, setOperatingHours] = useState('');

  // Stops & polyline
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [mapMode, setMapMode] = useState<'view' | 'add'>('view');
  const [polylineCoords, setPolylineCoords] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const nextId = useRef(0);
  const genId = () => `new_stop_${nextId.current++}`;

  // Build OSRM route
  const buildRoute = useCallback(async (currentStops: StopEntry[]) => {
    if (currentStops.length < 2) { setPolylineCoords([]); return; }
    const coords = currentStops.map((s) => [s.lng, s.lat] as [number, number]);
    const result = await getRoute(coords[0], coords[coords.length - 1],
      coords.length > 2 ? coords.slice(1, -1) : undefined);
    if (result?.code === 'Ok' && result.routes.length > 0) {
      setPolylineCoords(result.routes[0].geometry.coordinates as [number, number][]);
    } else {
      setPolylineCoords(coords);
    }
  }, []);

  // Auto-update route name
  const updateName = (updated: StopEntry[]) => {
    if (updated.length >= 2) setNameEn(`${updated[0].name_en} - ${updated[updated.length - 1].name_en}`);
    else if (updated.length === 1) setNameEn(updated[0].name_en);
    else setNameEn('');
  };

  // Add stop from coordinates (map click)
  const addStopFromCoords = useCallback(async (lat: number, lng: number) => {
    const geo = await reverseGeocode(lat, lng);
    const name = geo?.display_name?.split(',')[0] ?? `Stop at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const newStop: StopEntry = { id: genId(), name_en: name, name_si: '', name_ta: '', lat, lng, order: stops.length };
    const updated = [...stops, newStop];
    setStops(updated);
    buildRoute(updated);
    updateName(updated);
  }, [stops, buildRoute]);

  // Add stop from search
  const addStopFromSearch = useCallback((result: NominatimResult) => {
    const newStop: StopEntry = {
      id: genId(), name_en: result.display_name.split(',')[0],
      name_si: '', name_ta: '',
      lat: parseFloat(result.lat), lng: parseFloat(result.lon),
      order: stops.length,
    };
    const updated = [...stops, newStop];
    setStops(updated);
    buildRoute(updated);
    updateName(updated);
  }, [stops, buildRoute]);

  const removeStop = useCallback((index: number) => {
    const updated = stops.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setStops(updated);
    buildRoute(updated);
    updateName(updated);
  }, [stops, buildRoute]);

  const moveStop = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stops.length) return;
    const updated = [...stops];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((s, i) => ({ ...s, order: i }));
    setStops(reordered);
    buildRoute(reordered);
    updateName(reordered);
  }, [stops, buildRoute]);

  const updateStop = useCallback((index: number, field: keyof StopEntry, value: string | number) => {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  const handleDragEnd = useCallback((index: number, lngLat: { lng: number; lat: number }) => {
    setStops((prev) => {
      const updated = prev.map((s, i) => i === index ? { ...s, lat: lngLat.lat, lng: lngLat.lng } : s);
      buildRoute(updated);
      return updated;
    });
  }, [buildRoute]);

  // Save route
  const handleSave = async () => {
    if (!routeId.trim()) { toast.error('Route ID is required'); return; }
    if (!nameEn.trim()) { toast.error('Route name is required'); return; }
    if (stops.length < 2) { toast.error('At least 2 stops are required'); return; }
    setIsSaving(true);
    try {
      const trimmedRouteId = routeId.trim();

      await createRoute({
        id: trimmedRouteId, name_en: nameEn, name_si: nameSi, name_ta: nameTa,
        operator, service_type: serviceType, fare_lkr: fareLkr,
        frequency_minutes: frequencyMin, operating_hours: operatingHours,
      });

      const persistedStops = await Promise.all(stops.map(async (stop, index) => {
        const stopId = buildStopId(trimmedRouteId, stop.name_en, index);
        await createStop({
          id: stopId,
          name_en: stop.name_en,
          name_si: stop.name_si,
          name_ta: stop.name_ta,
          lat: stop.lat,
          lng: stop.lng,
          is_terminal: index === 0 || index === stops.length - 1,
        });

        return {
          ...stop,
          id: stopId,
          order: index,
        };
      }));

      setStops(persistedStops);

      await setRouteStops(trimmedRouteId, persistedStops.map((stop, index) => ({
        stop_id: stop.id,
        stop_order: index,
      })));

      if (polylineCoords.length >= 2) {
        await updatePolyline(trimmedRouteId, polylineCoords, 0.5);
      }

      toast.success('Route created successfully');
      navigate({ to: '/routes/$routeId', params: { routeId: trimmedRouteId } });
    } catch { toast.error('Failed to create route'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/routes' })}>
          <RiArrowLeftLine className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Add New Route</h1>
          <p className="text-sm text-muted-foreground">Create a route with stops using the interactive map</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || stops.length < 2}>
          <RiSaveLine className="size-4 mr-1" />
          {isSaving ? 'Creating...' : 'Create Route'}
        </Button>
      </div>

      {/* Two-column: Form + Map */}
      <div className="flex-1 flex gap-4 px-4 lg:px-6 min-h-0">
        {/* Left panel */}
        <div className="w-96 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Route metadata */}
          <Card>
            <CardHeader><CardTitle className="text-base">Route Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Route ID *</Label><Input value={routeId} onChange={(e) => setRouteId(e.target.value)} placeholder="e.g. 138" /></div>
                <div className="space-y-1"><Label className="text-xs">Operator</Label>
                  <Select value={operator} onValueChange={setOperator}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="SLTB">SLTB</SelectItem><SelectItem value="Private">Private</SelectItem></SelectGroup></SelectContent></Select>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Name (EN) *</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Auto-generated from stops" /></div>
              <div className="space-y-1"><Label className="text-xs">Name (SI) — සිංහල</Label><Input value={nameSi} onChange={(e) => setNameSi(e.target.value)} placeholder="සිංහල නම" /></div>
              <div className="space-y-1"><Label className="text-xs">Name (TA) — தமிழ்</Label><Input value={nameTa} onChange={(e) => setNameTa(e.target.value)} placeholder="தமிழ் பெயர்" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Service Type</Label>
                  <Select value={serviceType} onValueChange={setServiceType}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem><SelectItem value="Express">Express</SelectItem><SelectItem value="Luxury">Luxury</SelectItem></SelectGroup></SelectContent></Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Fare (LKR)</Label><Input type="number" value={fareLkr || ''} onChange={(e) => setFareLkr(Number(e.target.value))} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Frequency (min)</Label><Input type="number" value={frequencyMin || ''} onChange={(e) => setFrequencyMin(Number(e.target.value))} placeholder="15" /></div>
                <div className="space-y-1"><Label className="text-xs">Operating Hours</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="time" className="flex-1" value={operatingHours.split('-')[0] ?? ''} onChange={(e) => setOperatingHours(`${e.target.value}-${operatingHours.split('-')[1] ?? '22:00'}`)} />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="time" className="flex-1" value={operatingHours.split('-')[1] ?? ''} onChange={(e) => setOperatingHours(`${operatingHours.split('-')[0] ?? '05:00'}-${e.target.value}`)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search stop */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><RiSearchLine className="size-4" />Add Stop by Search</CardTitle></CardHeader>
            <CardContent><LocationAutocomplete placeholder="Search for a bus stop..." onSelect={addStopFromSearch} /></CardContent>
          </Card>

          {/* Stops list */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><RiRouteLine className="size-4" />Stops<Badge variant="secondary" className="text-xs">{stops.length}</Badge></span>
                <Button size="sm" variant={mapMode === 'add' ? 'default' : 'outline'} onClick={() => setMapMode(mapMode === 'add' ? 'view' : 'add')} className="gap-1">
                  {mapMode === 'add' ? <><RiCloseLine className="size-3.5" /> Done</> : <><RiMapPinAddLine className="size-3.5" /> Add on Map</>}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mapMode === 'add' && (
                <div className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2 mb-3">Click on the map to add stops. Drag markers to reposition.</div>
              )}
              {stops.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <RiMapPinAddLine className="size-8 mx-auto mb-2 opacity-40" />
                  <p>No stops yet.</p>
                  <p className="text-xs mt-1">Search above or click "Add on Map".</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {stops.map((stop, i) => (
                    <div key={stop.id} className="flex items-center gap-2 rounded-lg border p-2 group">
                      <span className={`flex items-center justify-center size-6 rounded-full text-xs font-bold text-white shrink-0 ${i === 0 ? 'bg-green-500' : i === stops.length - 1 ? 'bg-red-500' : 'bg-indigo-500'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <Input className="h-7 text-sm font-medium border-0 px-1 bg-transparent focus-visible:bg-background" value={stop.name_en} onChange={(e) => updateStop(i, 'name_en', e.target.value)} placeholder="Stop name" />
                        <span className="text-[10px] text-muted-foreground font-mono px-1">{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-6" onClick={() => moveStop(i, 'up')} disabled={i === 0}><RiArrowUpLine className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-6" onClick={() => moveStop(i, 'down')} disabled={i === stops.length - 1}><RiArrowDownLine className="size-3" /></Button>
                        <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={() => removeStop(i)}><RiDeleteBinLine className="size-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: Map */}
        <div className="flex-1 rounded-lg border overflow-hidden relative">
          <Map center={[79.8612, 6.9271]} zoom={11}>
            <MapControls showZoom showLocate showFullscreen />
            <MapClickHandler enabled={mapMode === 'add'} onMapClick={addStopFromCoords} />

            {/* Route polyline */}
            {polylineCoords.length >= 2 && (
              <MapRoute coordinates={polylineCoords} color="#e53e3e" width={4} />
            )}

            {/* Stop markers */}
            {stops.map((stop, i) => {
              const isFirst = i === 0;
              const isLast = i === stops.length - 1 && stops.length > 1;
              const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#6366f1';
              return (
                <MapMarker
                  key={stop.id}
                  longitude={stop.lng}
                  latitude={stop.lat}
                  draggable
                  onDragEnd={(lngLat) => handleDragEnd(i, lngLat)}
                >
                  <MarkerContent>
                    <div className="flex items-center justify-center size-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold text-white" style={{ background: color }}>
                      {i + 1}
                    </div>
                  </MarkerContent>
                  <MarkerTooltip>#{i + 1} {stop.name_en}</MarkerTooltip>
                </MapMarker>
              );
            })}
          </Map>

          {/* Map mode indicator */}
          {mapMode === 'add' && (
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg flex items-center gap-2 z-20">
              <RiMapPinAddLine className="size-4" />
              Click map to add stop
            </div>
          )}

          {/* Polyline stats */}
          {polylineCoords.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur rounded-lg border px-3 py-1.5 text-xs text-muted-foreground shadow z-20">
              {polylineCoords.length} polyline points · {stops.length} stops
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component to handle map clicks using useMap() hook
function MapClickHandler({ enabled, onMapClick }: { enabled: boolean; onMapClick: (lat: number, lng: number) => void }) {
  const { map } = useMap();
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;

  useEffect(() => {
    if (!map) return;

    const handler = (e: { lngLat: { lat: number; lng: number } }) => {
      if (enabled) onClickRef.current(e.lngLat.lat, e.lngLat.lng);
    };

    map.on('click', handler);
    map.getCanvas().style.cursor = enabled ? 'crosshair' : '';

    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map, enabled]);

  return null;
}
