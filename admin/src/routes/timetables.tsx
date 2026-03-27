import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Plus,
  Clock,
  Trash2,
  Save,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRoutes, setTimetable, type Route as RouteType } from '@/lib/api';

export const Route = createFileRoute('/timetables')({
  component: TimetablesPage,
});

interface TimetableEntry {
  time: string;
  days: string;
  service_type: string;
  notes: string;
}

const DAYS_OPTIONS = [
  'Weekdays',
  'Saturday',
  'Sunday',
  'Daily',
  'Mon-Sat',
  'Holidays',
];

const SERVICE_TYPES = ['Normal', 'Express', 'Semi-Express', 'Luxury', 'Highway'];

function TimetablesPage() {
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state for add/edit dialog
  const [formTime, setFormTime] = useState('');
  const [formDays, setFormDays] = useState('Daily');
  const [formServiceType, setFormServiceType] = useState('Normal');
  const [formNotes, setFormNotes] = useState('');

  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => fetchRoutes(),
    staleTime: 60_000,
  });

  const routes: RouteType[] = routeData?.routes ?? [];
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  const saveMutation = useMutation({
    mutationFn: (data: { routeId: string; entries: TimetableEntry[] }) =>
      setTimetable(
        data.routeId,
        data.entries.map((e) => ({
          time: e.time,
          days: e.days,
          service_type: e.service_type,
          notes: e.notes,
        }))
      ),
    onSuccess: () => {
      toast.success('Timetable saved successfully');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['timetable', selectedRouteId] });
    },
    onError: () => {
      toast.error('Failed to save timetable');
    },
  });

  const handleRouteChange = (routeId: string) => {
    setSelectedRouteId(routeId);
    // Reset entries when route changes (in production, fetch from backend)
    setEntries([]);
    setHasChanges(false);
  };

  const resetForm = () => {
    setFormTime('');
    setFormDays('Daily');
    setFormServiceType('Normal');
    setFormNotes('');
    setEditIndex(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEdit = (index: number) => {
    const entry = entries[index];
    setFormTime(entry.time);
    setFormDays(entry.days);
    setFormServiceType(entry.service_type);
    setFormNotes(entry.notes);
    setEditIndex(index);
    setShowAddDialog(true);
  };

  const handleSaveEntry = () => {
    if (!formTime) {
      toast.error('Please enter a departure time');
      return;
    }

    const newEntry: TimetableEntry = {
      time: formTime,
      days: formDays,
      service_type: formServiceType,
      notes: formNotes,
    };

    if (editIndex !== null) {
      const updated = [...entries];
      updated[editIndex] = newEntry;
      setEntries(updated);
    } else {
      setEntries([...entries, newEntry]);
    }

    setHasChanges(true);
    setShowAddDialog(false);
    resetForm();
  };

  const handleDeleteEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSaveTimetable = () => {
    if (!selectedRouteId) return;
    saveMutation.mutate({ routeId: selectedRouteId, entries });
  };

  if (routesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetables</h1>
          <p className="text-muted-foreground mt-1">
            Manage departure schedules for bus routes
          </p>
        </div>
        {selectedRouteId && hasChanges && (
          <Button
            size="sm"
            onClick={handleSaveTimetable}
            disabled={saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Timetable'}
          </Button>
        )}
      </div>

      {/* Route Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Route</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedRouteId} onValueChange={(v) => handleRouteChange(v ?? '')}>
              <SelectTrigger className="w-[400px]">
                <SelectValue placeholder="Choose a route..." />
              </SelectTrigger>
              <SelectContent>
                {routes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.id} — {route.name_en || 'Unnamed'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoute && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedRoute.operator || 'Unknown'}</Badge>
                <Badge variant={selectedRoute.is_active ? 'default' : 'secondary'}>
                  {selectedRoute.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      {selectedRouteId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Departures
                {entries.length > 0 && (
                  <Badge variant="secondary">{entries.length}</Badge>
                )}
              </CardTitle>
              <Button size="sm" onClick={handleOpenAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Departure
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">No departures yet</p>
                <p className="text-sm mt-1">
                  Click "Add Departure" to create the first schedule entry.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((entry, index) => (
                        <TableRow key={`${entry.time}-${index}`}>
                          <TableCell className="font-mono font-medium">
                            {entry.time}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{entry.days}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.service_type === 'Express'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {entry.service_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.notes || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleOpenEdit(index)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDeleteEntry(index)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Departure Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editIndex !== null ? 'Edit Departure' : 'Add Departure'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="time">Departure Time</Label>
              <Input
                id="time"
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Days</Label>
              <Select value={formDays} onValueChange={(v) => setFormDays(v ?? 'Daily')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OPTIONS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={formServiceType} onValueChange={(v) => setFormServiceType(v ?? 'Normal')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry}>
              {editIndex !== null ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
