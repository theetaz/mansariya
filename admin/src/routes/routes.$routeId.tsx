import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  RiArrowLeftLine,
  RiEditLine,
  RiSaveLine,
  RiCloseLine,
  RiTimeLine,
  RiAddLine,
  RiDeleteBinLine,
  RiBusLine,
  RiMapLine,
  RiListUnordered,
  RiRouteLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MapView } from '@/components/shared/map-view';
import {
  fetchAdminRouteDetail,
  updateRoute,
  setRouteStops,
  setTimetable,
} from '@/lib/api-functions';
import type {
  AdminRouteDetailInfo,
  AdminEnrichedStop,
  AdminTimetableEntry,
  AdminRoutePattern,
} from '@/lib/types';

export const Route = createFileRoute('/routes/$routeId')({
  component: RouteDetailPage,
});

function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-route', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
  });

  // Resolve selected pattern
  const patterns = detail?.patterns ?? [];
  const activePattern = useMemo(() => {
    if (!patterns.length) return null;
    if (selectedPatternId) return patterns.find((p) => p.id === selectedPatternId) ?? patterns[0];
    return patterns.find((p) => p.is_primary) ?? patterns[0];
  }, [patterns, selectedPatternId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6">
        <h1 className="text-2xl font-semibold text-destructive">Route not found</h1>
        <Button variant="outline" asChild>
          <Link to="/routes">Back to Routes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/routes">
            <RiArrowLeftLine className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Route {detail.route.id}</h1>
            <Badge variant={detail.route.is_active ? 'default' : 'secondary'} className="text-xs">
              {detail.route.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.route.name_en || 'Unnamed route'}
            {detail.route.name_si && ` · ${detail.route.name_si}`}
          </p>
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? (
            <><RiCloseLine className="size-4 mr-1" /> Cancel</>
          ) : (
            <><RiEditLine className="size-4 mr-1" /> Edit</>
          )}
        </Button>
      </div>

      {/* Route Info Card — polished */}
      <RouteInfoCard
        route={detail.route}
        patterns={patterns}
        stopsCount={detail.stops.length}
        isEditing={isEditing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] });
          setIsEditing(false);
        }}
      />

      {/* Pattern Selector (if multiple) */}
      {patterns.length > 1 && (
        <div className="px-4 lg:px-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Trip Pattern:</span>
            {patterns.map((p) => (
              <Button
                key={p.id}
                variant={activePattern?.id === p.id ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setSelectedPatternId(p.id)}
              >
                <RiRouteLine className="size-3.5" />
                {p.headsign}
                <Badge variant="secondary" className="text-xs ml-1">
                  {p.stop_count}
                </Badge>
                {p.is_primary && (
                  <Badge variant="outline" className="text-xs ml-0.5">Primary</Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Map + Stops Tabs */}
      <div className="px-4 lg:px-6">
        <Tabs defaultValue="map" className="w-full">
          <TabsList>
            <TabsTrigger value="map" className="gap-1.5">
              <RiMapLine className="size-4" />
              Route Map
            </TabsTrigger>
            <TabsTrigger value="stops" className="gap-1.5">
              <RiListUnordered className="size-4" />
              Trip Stops
              <Badge variant="secondary" className="text-xs ml-1">
                {detail.stops.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="timetable" className="gap-1.5">
              <RiTimeLine className="size-4" />
              Timetable
              <Badge variant="secondary" className="text-xs ml-1">
                {detail.timetable.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-3">
            <Card>
              <CardContent className="p-0">
                <MapView
                  className="h-[500px] rounded-lg overflow-hidden"
                  polyline={detail.polyline as [number, number][]}
                  stops={detail.stops.map((s) => ({
                    lat: s.lat,
                    lng: s.lng,
                    name: s.name_en,
                    order: s.stop_order,
                    isTerminal: s.is_terminal,
                  }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stops" className="mt-3">
            <StopsSection
              routeId={routeId}
              stops={detail.stops}
              isEditing={isEditing}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] })}
            />
          </TabsContent>

          <TabsContent value="timetable" className="mt-3">
            <TimetableSection
              routeId={routeId}
              timetable={detail.timetable}
              isEditing={isEditing}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Polished Route Info Card ──

function RouteInfoCard({
  route,
  patterns,
  stopsCount,
  isEditing,
  onSaved,
}: {
  route: AdminRouteDetailInfo;
  patterns: AdminRoutePattern[];
  stopsCount: number;
  isEditing: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name_en: route.name_en,
    name_si: route.name_si,
    name_ta: route.name_ta,
    operator: route.operator,
    service_type: route.service_type,
    fare_lkr: route.fare_lkr,
    frequency_minutes: route.frequency_minutes,
    operating_hours: route.operating_hours,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => updateRoute(route.id, data),
    onSuccess: () => { toast.success('Route updated'); onSaved(); },
    onError: () => toast.error('Failed to update route'),
  });

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isEditing) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit Route Information</CardTitle>
            <CardAction>
              <Button size="sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
                <RiSaveLine className="size-4 mr-1" />
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name (EN)</Label><Input value={form.name_en} onChange={(e) => handleChange('name_en', e.target.value)} /></div>
              <div className="space-y-2"><Label>Name (SI)</Label><Input value={form.name_si} onChange={(e) => handleChange('name_si', e.target.value)} /></div>
              <div className="space-y-2"><Label>Name (TA)</Label><Input value={form.name_ta} onChange={(e) => handleChange('name_ta', e.target.value)} /></div>
              <div className="space-y-2"><Label>Operator</Label>
                <Select value={form.operator} onValueChange={(v) => handleChange('operator', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="SLTB">SLTB</SelectItem><SelectItem value="Private">Private</SelectItem></SelectGroup></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Service Type</Label>
                <Select value={form.service_type} onValueChange={(v) => handleChange('service_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem><SelectItem value="Express">Express</SelectItem><SelectItem value="Luxury">Luxury</SelectItem></SelectGroup></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Fare (LKR)</Label><Input type="number" value={form.fare_lkr} onChange={(e) => handleChange('fare_lkr', Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Frequency (min)</Label><Input type="number" value={form.frequency_minutes} onChange={(e) => handleChange('frequency_minutes', Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Operating Hours</Label><Input value={form.operating_hours} onChange={(e) => handleChange('operating_hours', e.target.value)} placeholder="e.g. 05:00-22:00" /></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Top row: key stats */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <RiBusLine className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{route.id}</p>
                  <p className="text-xs text-muted-foreground">{route.operator || 'Unknown'} · {route.service_type || 'Normal'}</p>
                </div>
              </div>
              <Separator orientation="vertical" className="hidden sm:block h-8" />
              <StatPill label="Stops" value={stopsCount} />
              <StatPill label="Patterns" value={patterns.length} />
              {route.fare_lkr > 0 && <StatPill label="Fare" value={`Rs. ${route.fare_lkr}`} />}
              {route.frequency_minutes > 0 && <StatPill label="Frequency" value={`${route.frequency_minutes} min`} />}
              {route.operating_hours && <StatPill label="Hours" value={route.operating_hours} />}
            </div>

            <Separator />

            {/* Names row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoField label="English" value={route.name_en} />
              <InfoField label="සිංහල" value={route.name_si} />
              <InfoField label="தமிழ்" value={route.name_ta} />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>Source: {route.source || '—'}</span>
              <span>Data: {route.data_source || '—'}</span>
              <span>Created: {formatDate(route.created_at)}</span>
              <span>Updated: {formatDate(route.updated_at)}</span>
              {route.validated_by && <span>Validated by: {route.validated_by}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Stops Section ──

function StopsSection({
  routeId,
  stops: initialStops,
  isEditing,
  onSaved,
}: {
  routeId: string;
  stops: AdminEnrichedStop[];
  isEditing: boolean;
  onSaved: () => void;
}) {
  const [stops, setStops] = useState<AdminEnrichedStop[]>(initialStops);

  const mutation = useMutation({
    mutationFn: () =>
      setRouteStops(routeId, stops.map((s) => ({ stop_id: s.stop_id, stop_order: s.stop_order }))),
    onSuccess: () => { toast.success('Stops updated'); onSaved(); },
    onError: () => toast.error('Failed to update stops'),
  });

  const updateStop = (index: number, field: keyof AdminEnrichedStop, value: number) => {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  return (
    <Card>
      {isEditing && (
        <CardHeader>
          <CardTitle className="text-base">Edit Stops</CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <RiSaveLine className="size-4 mr-1" />
              {mutation.isPending ? 'Saving...' : 'Save Stops'}
            </Button>
          </CardAction>
        </CardHeader>
      )}
      <CardContent className={isEditing ? '' : 'pt-6'}>
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No stops assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Stop Name</TableHead>
                  <TableHead>Name (SI)</TableHead>
                  <TableHead className="text-right">Lat</TableHead>
                  <TableHead className="text-right">Lng</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead>Terminal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stops.map((stop, idx) => (
                  <TableRow key={stop.stop_id}>
                    <TableCell>
                      <span className="flex items-center justify-center size-6 rounded-full bg-muted text-xs font-medium">
                        {stop.stop_order + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{stop.name_en || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{stop.name_si || '—'}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input type="number" step="0.000001" className="w-28 text-right text-xs" value={stop.lat} onChange={(e) => updateStop(idx, 'lat', Number(e.target.value))} />
                      ) : (
                        <span className="font-mono text-xs">{stop.lat.toFixed(6)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input type="number" step="0.000001" className="w-28 text-right text-xs" value={stop.lng} onChange={(e) => updateStop(idx, 'lng', Number(e.target.value))} />
                      ) : (
                        <span className="font-mono text-xs">{stop.lng.toFixed(6)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{stop.distance_from_start_km.toFixed(1)} km</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{stop.typical_duration_min} min</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">Rs. {stop.fare_from_start_lkr}</TableCell>
                    <TableCell>
                      {stop.is_terminal ? (
                        <Badge variant="default" className="text-xs">Terminal</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Timetable Section ──

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

function TimetableSection({
  routeId,
  timetable: initialTimetable,
  isEditing,
  onSaved,
}: {
  routeId: string;
  timetable: AdminTimetableEntry[];
  isEditing: boolean;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<AdminTimetableEntry[]>(initialTimetable);

  const mutation = useMutation({
    mutationFn: () =>
      setTimetable(routeId, entries.map((e) => ({
        route_id: routeId, departure_time: e.departure_time, days: e.days, service_type: e.service_type, notes: e.notes,
      }))),
    onSuccess: () => { toast.success('Timetable updated'); onSaved(); },
    onError: () => toast.error('Failed to update timetable'),
  });

  const updateEntry = (index: number, field: keyof AdminTimetableEntry, value: unknown) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const toggleDay = (index: number, day: string) => {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== index) return e;
      const days = e.days.includes(day) ? e.days.filter((d) => d !== day) : [...e.days, day];
      return { ...e, days };
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RiTimeLine className="size-4" />
          Timetable
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
        </CardTitle>
          {isEditing && (
            <CardAction className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEntries((prev) => [...prev, { id: 0, route_id: routeId, departure_time: '06:00', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], service_type: 'Normal', notes: '' }])}>
                <RiAddLine className="size-4 mr-1" /> Add
              </Button>
              <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <RiSaveLine className="size-4 mr-1" /> {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No timetable entries.{isEditing && ' Click "Add" to create one.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departure</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Notes</TableHead>
                    {isEditing && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={`${entry.id}-${idx}`}>
                      <TableCell>
                        {isEditing ? (
                          <Input type="time" className="w-28" value={entry.departure_time} onChange={(e) => updateEntry(idx, 'departure_time', e.target.value)} />
                        ) : (
                          <span className="font-mono text-sm">{entry.departure_time}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isEditing ? ALL_DAYS.map((d) => (
                            <Badge key={d} variant={entry.days.includes(d) ? 'default' : 'outline'} className="cursor-pointer text-xs select-none" onClick={() => toggleDay(idx, d)}>{d}</Badge>
                          )) : entry.days.map((d) => (
                            <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select value={entry.service_type} onValueChange={(v) => updateEntry(idx, 'service_type', v)}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectGroup><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem><SelectItem value="Express">Express</SelectItem></SelectGroup></SelectContent>
                          </Select>
                        ) : <span className="text-sm">{entry.service_type}</span>}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input className="w-40" value={entry.notes} placeholder="Notes..." onChange={(e) => updateEntry(idx, 'notes', e.target.value)} />
                        ) : <span className="text-sm text-muted-foreground">{entry.notes || '—'}</span>}
                      </TableCell>
                      {isEditing && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}>
                            <RiDeleteBinLine className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
  );
}
