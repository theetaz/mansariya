import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { RiMoreLine, RiAddLine, RiCheckLine, RiCloseLine } from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumnHeader } from '@/components/shared/data-table';
import { fetchAdminRoutes, deleteRoute } from '@/lib/api-functions';
import type { AdminRouteWithStats } from '@/lib/types';

export const Route = createFileRoute('/routes/')({
  component: RoutesPage,
});

function RoutesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      toast.success('Route deleted');
    },
    onError: () => toast.error('Failed to delete route'),
  });

  const columns: ColumnDef<AdminRouteWithStats>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
      cell: ({ row }) => (
        <Link
          to={'/routes/$routeId'}
          params={{ routeId: row.original.id }}
          className="font-mono text-xs text-primary underline-offset-4 hover:underline"
        >
          {row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: 'name_en',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <Link
          to={'/routes/$routeId'}
          params={{ routeId: row.original.id }}
          className="block max-w-[300px] hover:underline underline-offset-4"
        >
          <div className="font-medium truncate">{row.original.name_en || '—'}</div>
          {row.original.name_si && (
            <div className="text-xs text-muted-foreground truncate">{row.original.name_si}</div>
          )}
        </Link>
      ),
    },
    {
      accessorKey: 'operator',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Operator" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.operator || '—'}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'select',
          label: 'Operator',
          options: [
            { label: 'SLTB', value: 'SLTB' },
            { label: 'Private', value: 'Private' },
          ],
        },
      },
    },
    {
      accessorKey: 'service_type',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
      cell: ({ row }) => <span className="text-sm">{row.original.service_type || '—'}</span>,
      meta: {
        filterConfig: {
          type: 'select',
          label: 'Service Type',
          options: [
            { label: 'Normal', value: 'Normal' },
            { label: 'Semi-Luxury', value: 'Semi-Luxury' },
            { label: 'Luxury', value: 'Luxury' },
            { label: 'Express', value: 'Express' },
          ],
        },
      },
    },
    {
      accessorKey: 'fare_lkr',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fare" className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.fare_lkr ? `Rs. ${row.original.fare_lkr}` : '—'}
        </div>
      ),
    },
    {
      accessorKey: 'stop_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stops" className="text-right" />,
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.stop_count}</div>,
    },
    {
      accessorKey: 'has_polyline',
      header: 'Polyline',
      cell: ({ row }) =>
        row.original.has_polyline ? (
          <RiCheckLine className="size-4 text-green-500" />
        ) : (
          <RiCloseLine className="size-4 text-muted-foreground" />
        ),
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'} className="text-xs">
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'boolean',
          label: 'Active Status',
        },
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8" size="icon">
              <RiMoreLine />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem asChild>
              <Link to={'/routes/$routeId'} params={{ routeId: row.original.id }}>
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={'/routes/$routeId'} params={{ routeId: row.original.id }}>
                View Stops
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteMutation.mutate(row.original.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.count ?? 0} routes in the database
          </p>
        </div>
        <Button size="sm">
          <RiAddLine className="size-4 mr-1" />
          Add Route
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.routes ?? []}
        searchPlaceholder="Search routes..."
        isLoading={isLoading}
      />
    </div>
  );
}
