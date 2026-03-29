import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiTimeLine } from '@remixicon/react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchAdminRoutes, setTimetable } from '@/lib/api-functions';
import type { TimetableInput } from '@/lib/types';

export const Route = createFileRoute('/timetables')({
  component: TimetablesPage,
});

const DAY_OPTIONS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface TimetableEntry extends TimetableInput {
  _key: string;
}

function TimetablesPage() {
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const saveMutation = useMutation({
    mutationFn: ({ routeId, data }: { routeId: string; data: TimetableInput[] }) =>
      setTimetable(routeId, data),
    onSuccess: () => {
      toast.success('Timetable saved');
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
    },
    onError: () => toast.error('Failed to save timetable'),
  });

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        _key: crypto.randomUUID(),
        route_id: selectedRouteId,
        departure_time: '',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        service_type: 'Normal',
        notes: '',
      },
    ]);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e._key !== key));
  };

  const updateEntry = (key: string, field: keyof TimetableInput, value: string | string[]) => {
    setEntries((prev) =>
      prev.map((e) => (e._key === key ? { ...e, [field]: value } : e)),
    );
  };

  const handleSave = () => {
    if (!selectedRouteId) return;
    const data = entries.map(({ _key, ...rest }) => rest);
    saveMutation.mutate({ routeId: selectedRouteId, data });
  };

  const routes = routeData?.routes ?? [];

  if (routesLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 px-4 lg:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Timetables</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage departure schedules for bus routes
          </p>
        </div>
        {selectedRouteId && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addEntry}>
              <RiAddLine className="size-4 mr-1" />
              Add Departure
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              Save Timetable
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2 max-w-xs">
          <Label>Select Route</Label>
          <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a route..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.id} — {r.name_en || 'Unnamed'}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedRouteId && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RiTimeLine className="size-4" />
                Departures for Route {selectedRouteId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No departures yet.</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={addEntry}>
                    <RiAddLine className="size-4 mr-1" />
                    Add First Departure
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
                      .map((entry) => (
                        <TableRow key={entry._key}>
                          <TableCell>
                            <Input
                              type="time"
                              value={entry.departure_time}
                              onChange={(e) => updateEntry(entry._key, 'departure_time', e.target.value)}
                              className="w-28 h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {DAY_OPTIONS.map((day) => (
                                <Badge
                                  key={day}
                                  variant={entry.days.includes(day) ? 'default' : 'outline'}
                                  className="cursor-pointer text-xs"
                                  onClick={() => {
                                    const newDays = entry.days.includes(day)
                                      ? entry.days.filter((d) => d !== day)
                                      : [...entry.days, day];
                                    updateEntry(entry._key, 'days', newDays);
                                  }}
                                >
                                  {day}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={entry.service_type}
                              onValueChange={(v) => updateEntry(entry._key, 'service_type', v)}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Normal">Normal</SelectItem>
                                <SelectItem value="Semi-Luxury">Semi-Luxury</SelectItem>
                                <SelectItem value="Express">Express</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.notes ?? ''}
                              onChange={(e) => updateEntry(entry._key, 'notes', e.target.value)}
                              placeholder="Optional notes..."
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              onClick={() => removeEntry(entry._key)}
                            >
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
