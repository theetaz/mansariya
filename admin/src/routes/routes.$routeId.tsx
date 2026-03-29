import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  RiArrowLeftLine,
  RiEditLine,
  RiSaveLine,
  RiCloseLine,
  RiMapPinLine,
  RiTimeLine,
  RiAddLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/lib/types';

export const Route = createFileRoute('/routes/$routeId')({
  component: RouteDetailPage,
});

// ── Main Page ──

function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-route', routeId],
    queryFn: () => fetchAdminRouteDetail(routeId),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6">
        <h1 className="text-2xl font-semibold text-destructive">Route not found</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Back + title bar */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/routes">
            <RiArrowLeftLine className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Route {detail.route.id}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.route.name_en || 'Unnamed route'}
          </p>
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? (
            <>
              <RiCloseLine className="size-4 mr-1" /> Cancel
            </>
          ) : (
            <>
              <RiEditLine className="size-4 mr-1" /> Edit
            </>
          )}
        </Button>
      </div>

      {/* Route Info Card */}
      <RouteInfoCard
        route={detail.route}
        isEditing={isEditing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] });
          setIsEditing(false);
        }}
      />

      {/* Route Map */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RiMapPinLine className="size-4" />
              Route Map
            </CardTitle>
            <CardAction>
              <Badge variant="secondary" className="text-xs">
                {detail.polyline.length} points, {detail.stops.length} stops
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <MapView
              className="h-80 rounded-lg overflow-hidden"
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
      </div>

      {/* Route Patterns */}
      {detail.patterns && detail.patterns.length > 1 && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Trip Patterns
              </CardTitle>
              <CardAction>
                <Badge variant="secondary" className="text-xs">
                  {detail.patterns.length} variants
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 @xl/main:grid-cols-3">
                {detail.patterns.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-3 ${p.is_primary ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.headsign}</span>
                      {p.is_primary && (
                        <Badge variant="default" className="text-xs">Primary</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.stop_count} stops · {p.direction === 0 ? 'Outbound' : 'Inbound'} · {p.source}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stops Section */}
      <StopsSection
        routeId={routeId}
        stops={detail.stops}
        isEditing={isEditing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] });
        }}
      />

      {/* Timetable Section */}
      <TimetableSection
        routeId={routeId}
        timetable={detail.timetable}
        isEditing={isEditing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-route', routeId] });
        }}
      />
    </div>
  );
}

// ── Route Info Card ──

function RouteInfoCard({
  route,
  isEditing,
  onSaved,
}: {
  route: AdminRouteDetailInfo;
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
    onSuccess: () => {
      toast.success('Route updated successfully');
      onSaved();
    },
    onError: () => toast.error('Failed to update route'),
  });

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Route Information</CardTitle>
          {isEditing && (
            <CardAction>
              <Button
                size="sm"
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
              >
                <RiSaveLine className="size-4 mr-1" />
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID</Label>
                <Input value={route.id} disabled />
              </div>
              <div className="space-y-2">
                <Label>Name (EN)</Label>
                <Input
                  value={form.name_en}
                  onChange={(e) => handleChange('name_en', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Name (SI)</Label>
                <Input
                  value={form.name_si}
                  onChange={(e) => handleChange('name_si', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Name (TA)</Label>
                <Input
                  value={form.name_ta}
                  onChange={(e) => handleChange('name_ta', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={form.operator}
                  onValueChange={(v) => handleChange('operator', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="SLTB">SLTB</SelectItem>
                      <SelectItem value="Private">Private</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select
                  value={form.service_type}
                  onValueChange={(v) => handleChange('service_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem>
                      <SelectItem value="Express">Express</SelectItem>
                      <SelectItem value="Luxury">Luxury</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fare (LKR)</Label>
                <Input
                  type="number"
                  value={form.fare_lkr}
                  onChange={(e) => handleChange('fare_lkr', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency (minutes)</Label>
                <Input
                  type="number"
                  value={form.frequency_minutes}
                  onChange={(e) => handleChange('frequency_minutes', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Operating Hours</Label>
                <Input
                  value={form.operating_hours}
                  onChange={(e) => handleChange('operating_hours', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoField label="ID" value={route.id} mono />
              <InfoField label="Name (EN)" value={route.name_en} />
              <InfoField label="Name (SI)" value={route.name_si} />
              <InfoField label="Name (TA)" value={route.name_ta} />
              <InfoField label="Operator" value={route.operator} />
              <InfoField label="Service Type" value={route.service_type} />
              <InfoField label="Fare (LKR)" value={route.fare_lkr ? `Rs. ${route.fare_lkr}` : '—'} />
              <InfoField
                label="Frequency"
                value={route.frequency_minutes ? `${route.frequency_minutes} min` : '—'}
              />
              <InfoField label="Operating Hours" value={route.operating_hours} />
              <InfoField label="Source" value={route.source} />
              <InfoField label="Data Source" value={route.data_source} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={route.is_active ? 'default' : 'secondary'}>
                  {route.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <InfoField label="Created" value={formatDate(route.created_at)} />
              <InfoField label="Updated" value={formatDate(route.updated_at)} />
              {route.validated_by && (
                <InfoField
                  label="Validated"
                  value={`${route.validated_by} at ${formatDate(route.validated_at ?? '')}`}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  // Sync when props change (e.g. after save/refetch)
  useState(() => {
    setStops(initialStops);
  });

  const mutation = useMutation({
    mutationFn: () =>
      setRouteStops(
        routeId,
        stops.map((s) => ({ stop_id: s.stop_id, stop_order: s.stop_order })),
      ),
    onSuccess: () => {
      toast.success('Stops updated successfully');
      onSaved();
    },
    onError: () => toast.error('Failed to update stops'),
  });

  const updateStop = (index: number, field: keyof AdminEnrichedStop, value: number) => {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiMapPinLine className="size-4" />
            Stops ({stops.length})
          </CardTitle>
          {isEditing && (
            <CardAction>
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <RiSaveLine className="size-4 mr-1" />
                {mutation.isPending ? 'Saving...' : 'Save Stops'}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {stops.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No stops assigned to this route yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name (EN)</TableHead>
                    <TableHead className="text-right">Lat</TableHead>
                    <TableHead className="text-right">Lng</TableHead>
                    <TableHead className="text-right">Distance (km)</TableHead>
                    <TableHead className="text-right">Duration (min)</TableHead>
                    <TableHead className="text-right">Fare (LKR)</TableHead>
                    <TableHead>Terminal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stops.map((stop, idx) => (
                    <TableRow key={stop.stop_id}>
                      <TableCell className="font-mono text-xs">{stop.stop_order}</TableCell>
                      <TableCell className="font-medium">{stop.name_en || '—'}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.000001"
                            className="w-28 text-right text-xs"
                            value={stop.lat}
                            onChange={(e) =>
                              updateStop(idx, 'lat', Number(e.target.value))
                            }
                          />
                        ) : (
                          <span className="font-mono text-xs">{stop.lat.toFixed(6)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.000001"
                            className="w-28 text-right text-xs"
                            value={stop.lng}
                            onChange={(e) =>
                              updateStop(idx, 'lng', Number(e.target.value))
                            }
                          />
                        ) : (
                          <span className="font-mono text-xs">{stop.lng.toFixed(6)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stop.distance_from_start_km.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stop.typical_duration_min}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stop.fare_from_start_lkr}
                      </TableCell>
                      <TableCell>
                        {stop.is_terminal ? (
                          <Badge variant="default" className="text-xs">
                            Terminal
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
    </div>
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

  // Sync when props change
  useState(() => {
    setEntries(initialTimetable);
  });

  const mutation = useMutation({
    mutationFn: () =>
      setTimetable(
        routeId,
        entries.map((e) => ({
          route_id: routeId,
          departure_time: e.departure_time,
          days: e.days,
          service_type: e.service_type,
          notes: e.notes,
        })),
      ),
    onSuccess: () => {
      toast.success('Timetable updated successfully');
      onSaved();
    },
    onError: () => toast.error('Failed to update timetable'),
  });

  const updateEntry = (index: number, field: keyof AdminTimetableEntry, value: unknown) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  };

  const toggleDay = (index: number, day: string) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const days = e.days.includes(day)
          ? e.days.filter((d) => d !== day)
          : [...e.days, day];
        return { ...e, days };
      }),
    );
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: 0,
        route_id: routeId,
        departure_time: '06:00',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        service_type: 'Normal',
        notes: '',
      },
    ]);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiTimeLine className="size-4" />
            Timetable ({entries.length} entries)
          </CardTitle>
          {isEditing && (
            <CardAction className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addEntry}>
                <RiAddLine className="size-4 mr-1" />
                Add Entry
              </Button>
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <RiSaveLine className="size-4 mr-1" />
                {mutation.isPending ? 'Saving...' : 'Save Timetable'}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No timetable entries for this route yet.
              {isEditing && ' Click "Add Entry" to create one.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departure Time</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Notes</TableHead>
                    {isEditing && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={`${entry.id}-${idx}`}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="time"
                            className="w-32 text-sm"
                            value={entry.departure_time}
                            onChange={(e) =>
                              updateEntry(idx, 'departure_time', e.target.value)
                            }
                          />
                        ) : (
                          <span className="font-mono text-sm">{entry.departure_time}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isEditing
                            ? ALL_DAYS.map((day) => (
                                <Badge
                                  key={day}
                                  variant={entry.days.includes(day) ? 'default' : 'outline'}
                                  className="cursor-pointer text-xs select-none"
                                  onClick={() => toggleDay(idx, day)}
                                >
                                  {day}
                                </Badge>
                              ))
                            : entry.days.map((day) => (
                                <Badge key={day} variant="secondary" className="text-xs">
                                  {day}
                                </Badge>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={entry.service_type}
                            onValueChange={(v) => updateEntry(idx, 'service_type', v)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="Normal">Normal</SelectItem>
                                <SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem>
                                <SelectItem value="Express">Express</SelectItem>
                                <SelectItem value="Luxury">Luxury</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{entry.service_type}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            className="w-40 text-sm"
                            value={entry.notes}
                            placeholder="Optional notes"
                            onChange={(e) => updateEntry(idx, 'notes', e.target.value)}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {entry.notes || '—'}
                          </span>
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeEntry(idx)}
                          >
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
    </div>
  );
}
