import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { RiMoreLine, RiAddLine, RiCheckLine, RiCloseLine } from '@remixicon/react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { fetchAdminRoutes, deleteRoute, setRouteActive } from '@/lib/api-functions';
import type { AdminRouteWithStats } from '@/lib/types';

export const Route = createFileRoute('/routes/')({
  component: RoutesPage,
});

function RoutesPage() {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{
    routeId: string;
    routeName: string;
    action: 'delete' | 'inactivate' | 'activate';
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-routes'],
    queryFn: fetchAdminRoutes,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      setPendingAction(null);
      toast.success('Route deleted permanently');
    },
    onError: () => toast.error('Failed to delete route'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ routeId, isActive }: { routeId: string; isActive: boolean }) =>
      setRouteActive(routeId, isActive),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-routes'] });
      setPendingAction(null);
      toast.success(variables.isActive ? 'Route activated' : 'Route inactivated');
    },
    onError: () => toast.error('Failed to update route status'),
  });

  const isConfirming = deleteMutation.isPending || statusMutation.isPending;

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
      header: 'Actions',
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
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={'/routes/$routeId'} params={{ routeId: row.original.id }}>
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.is_active ? (
              <DropdownMenuItem
                onClick={() => setPendingAction({
                  routeId: row.original.id,
                  routeName: row.original.name_en || row.original.id,
                  action: 'inactivate',
                })}
              >
                Inactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setPendingAction({
                  routeId: row.original.id,
                  routeName: row.original.name_en || row.original.id,
                  action: 'activate',
                })}
              >
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setPendingAction({
                routeId: row.original.id,
                routeName: row.original.name_en || row.original.id,
                action: 'delete',
              })}
            >
              Delete Permanently
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
        <Button size="sm" asChild>
          <Link to="/routes/new">
            <RiAddLine className="size-4 mr-1" />
            Add Route
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.routes ?? []}
        searchPlaceholder="Search routes..."
        isLoading={isLoading}
      />

      {pendingAction && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction.action === 'delete'
                  ? 'Delete route permanently?'
                  : pendingAction.action === 'activate'
                    ? 'Activate route?'
                    : 'Inactivate route?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction.action === 'delete'
                  ? `This will permanently remove ${pendingAction.routeId} and its related route data.`
                  : pendingAction.action === 'activate'
                    ? `This will mark ${pendingAction.routeId} as active again.`
                    : `This will keep ${pendingAction.routeId} in the database but mark it as inactive.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={pendingAction.action === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                disabled={isConfirming}
                onClick={(event) => {
                  event.preventDefault();

                  if (pendingAction.action === 'delete') {
                    deleteMutation.mutate(pendingAction.routeId);
                    return;
                  }

                  statusMutation.mutate({
                    routeId: pendingAction.routeId,
                    isActive: pendingAction.action === 'activate',
                  });
                }}
              >
                {isConfirming
                  ? 'Working...'
                  : pendingAction.action === 'delete'
                    ? 'Delete'
                    : pendingAction.action === 'activate'
                      ? 'Activate'
                      : 'Inactivate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
