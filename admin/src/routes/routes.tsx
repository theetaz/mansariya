import { createFileRoute } from '@tanstack/react-router';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDown,
  MoreHorizontal,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  Map,
  Check,
  X,
  Download,
} from 'lucide-react';
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
import { useRoutes, useDeleteRoute } from '@/hooks/useRoutes';
import { type Route as RouteType } from '@/lib/api';
import { useState } from 'react';

export const Route = createFileRoute('/routes')({
  component: RoutesPage,
});

function RoutesPage() {
  const { data: routes, isLoading, error } = useRoutes();
  const deleteMutation = useDeleteRoute();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success(`Route ${deleteTarget} deleted`);
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error('Failed to delete route');
      },
    });
  };

  const handleExportCSV = () => {
    if (!routes) return;
    const headers = ['ID', 'Name EN', 'Name SI', 'Name TA', 'Operator', 'Service Type', 'Fare LKR'];
    const rows = routes.map((r) => [
      r.id, r.name_en, r.name_si, r.name_ta, r.operator, r.service_type, String(r.fare_lkr),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mansariya-routes.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Routes exported as CSV');
  };

  const columns: ColumnDef<RouteType>[] = [
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
        <span className="font-mono font-medium">{row.getValue('id')}</span>
      ),
    },
    {
      accessorKey: 'name_en',
      header: 'Name',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="font-medium">{r.name_en || '—'}</div>
            {r.name_si && (
              <div className="text-xs text-muted-foreground">{r.name_si}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'operator',
      header: 'Operator',
      cell: ({ row }) => {
        const op = row.getValue('operator') as string;
        if (!op) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge variant={op === 'SLTB' ? 'default' : 'secondary'}>
            {op}
          </Badge>
        );
      },
      filterFn: 'equals',
    },
    {
      accessorKey: 'service_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue('service_type') || '—'}</span>
      ),
    },
    {
      accessorKey: 'fare_lkr',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Fare
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const fare = row.getValue('fare_lkr') as number;
        return fare ? <span>Rs. {fare}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'polyline',
      header: 'Map',
      cell: ({ row }) => {
        const hasPolyline = row.original.polyline && row.original.polyline.length > 0;
        return hasPolyline ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
      cell: ({ row }) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'secondary'}>
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const route = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Map className="mr-2 h-4 w-4" />
                View on Map
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MapPin className="mr-2 h-4 w-4" />
                Manage Stops
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget(route.id)}
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
      <div className="px-4 py-4 lg:px-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4 lg:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-destructive">Error</h1>
        <p className="text-muted-foreground mt-2">Failed to load routes. Is the backend running?</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Routes</h1>
          <p className="text-muted-foreground mt-1">
            {routes?.length ?? 0} routes in the database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={routes ?? []}
        searchKey="name_en"
        searchPlaceholder="Search routes..."
        filterOptions={[
          {
            key: 'operator',
            label: 'Operator',
            options: [
              { label: 'SLTB', value: 'SLTB' },
              { label: 'Private', value: 'Private' },
              { label: 'NTC', value: 'NTC' },
            ],
          },
        ]}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Route {deleteTarget}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the route, its stops, and timetable data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
