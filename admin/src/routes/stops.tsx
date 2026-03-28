import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDown,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/shared/data-table';
import api, { type Stop } from '@/lib/api';

export const Route = createFileRoute('/stops')({
  component: StopsPage,
});

function fetchNearbyStops() {
  return api
    .get<{ stops: Stop[]; count: number }>(
      '/api/v1/stops/nearby?lat=7.0&lng=80.0&radius_km=500'
    )
    .then((r) => r.data);
}

function StopsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stops'],
    queryFn: fetchNearbyStops,
    staleTime: 60_000,
  });

  const [deleteTarget, setDeleteTarget] = useState<Stop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stops = data?.stops ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/admin/stops/${deleteTarget.id}`);
      toast.success(`Stop "${deleteTarget.name_en}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete stop');
    } finally {
      setIsDeleting(false);
    }
  };

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="default">High</Badge>;
    if (confidence >= 0.5) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const columns: ColumnDef<Stop>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          ID
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.getValue('id')}</span>
      ),
    },
    {
      accessorKey: 'name_en',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name EN
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('name_en') || '—'}</div>
      ),
    },
    {
      accessorKey: 'name_si',
      header: 'Name SI',
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue('name_si') || '—'}</span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const loc = row.original.location;
        if (!loc || loc.length < 2) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-mono text-xs">
            {loc[0].toFixed(4)}, {loc[1].toFixed(4)}
          </span>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => {
        const source = row.getValue('source') as string;
        if (!source) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge variant={source === 'ntc' ? 'default' : 'secondary'}>
            {source}
          </Badge>
        );
      },
      filterFn: 'equals',
    },
    {
      accessorKey: 'confidence',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Confidence
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => confidenceBadge(row.getValue('confidence') as number),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const stop = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MapPin className="mr-2 h-4 w-4" />
                View on Map
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget(stop)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight text-destructive">Error</h1>
        <p className="text-muted-foreground mt-2">Failed to load stops. Is the backend running?</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stops</h1>
          <p className="text-muted-foreground mt-1">
            {stops.length} stops in the database
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Stop
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={stops}
        searchKey="name_en"
        searchPlaceholder="Search stops by name..."
        filterOptions={[
          {
            key: 'source',
            label: 'Source',
            options: [
              { label: 'NTC', value: 'ntc' },
              { label: 'Crowdsourced', value: 'crowdsourced' },
              { label: 'Manual', value: 'manual' },
              { label: 'GTFS', value: 'gtfs' },
            ],
          },
        ]}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stop?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{deleteTarget?.name_en}".
              Any route associations will also be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
