import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  RiPlayLine,
  RiPauseLine,
  RiStopLine,
  RiMoreLine,
  RiAddLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumnHeader } from '@/components/shared/data-table';
import {
  fetchSimulations,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  deleteSimulation,
} from '@/lib/api-functions';
import type { SimulationJob, SimulationStatus } from '@/lib/types';

export const Route = createFileRoute('/simulations/')({
  component: SimulationsPage,
});

const statusConfig: Record<SimulationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  running: { label: 'Running', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  stopped: { label: 'Stopped', variant: 'destructive' },
};

function SimulationsPage() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['simulations'],
    queryFn: fetchSimulations,
    refetchInterval: 5000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['simulations'] });
  const startMut = useMutation({ mutationFn: startSimulation, onSuccess: () => { invalidate(); toast.success('Simulation started'); } });
  const pauseMut = useMutation({ mutationFn: pauseSimulation, onSuccess: () => { invalidate(); toast.success('Simulation paused'); } });
  const resumeMut = useMutation({ mutationFn: resumeSimulation, onSuccess: () => { invalidate(); toast.success('Simulation resumed'); } });
  const stopMut = useMutation({ mutationFn: stopSimulation, onSuccess: () => { invalidate(); toast.success('Simulation stopped'); } });
  const deleteMut = useMutation({ mutationFn: deleteSimulation, onSuccess: () => { invalidate(); toast.success('Simulation deleted'); }, onError: () => toast.error('Failed to delete simulation') });

  const columns: ColumnDef<SimulationJob>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'route_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Route" />,
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground mr-1">{row.original.route_id}</span>
          {row.original.route_name && (
            <span className="text-sm">{row.original.route_name}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'vehicle_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Buses" className="text-right" />,
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.vehicle_count ?? 0}</div>,
    },
    {
      accessorKey: 'device_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Devices" className="text-right" />,
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.device_count ?? 0}</div>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const cfg = statusConfig[row.original.status];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
      meta: {
        filterConfig: {
          type: 'select' as const,
          label: 'Status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Running', value: 'running' },
            { label: 'Paused', value: 'paused' },
            { label: 'Stopped', value: 'stopped' },
          ],
        },
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const sim = row.original;
        return (
          <div className="flex items-center gap-1">
            {/* Quick action buttons */}
            {(sim.status === 'draft' || sim.status === 'stopped') && (
              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => startMut.mutate(sim.id)} title="Start">
                <RiPlayLine className="size-4 text-green-600" />
              </Button>
            )}
            {sim.status === 'running' && (
              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => pauseMut.mutate(sim.id)} title="Pause">
                <RiPauseLine className="size-4 text-amber-500" />
              </Button>
            )}
            {sim.status === 'paused' && (
              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => resumeMut.mutate(sim.id)} title="Resume">
                <RiPlayLine className="size-4 text-green-600" />
              </Button>
            )}
            {(sim.status === 'running' || sim.status === 'paused') && (
              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => stopMut.mutate(sim.id)} title="Stop">
                <RiStopLine className="size-4 text-red-500" />
              </Button>
            )}

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="size-8" size="icon">
                  <RiMoreLine />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {(sim.status === 'draft' || sim.status === 'stopped') && (
                  <DropdownMenuItem asChild>
                    <Link to={'/simulations/$simId/edit' as string} params={{ simId: sim.id }}>Edit</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(sim.id);
                    toast.success('ID copied');
                  }}
                >
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={sim.status === 'running' || sim.status === 'paused'}
                  onClick={() => setDeleteTarget({ id: sim.id, name: sim.name })}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Simulations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.count ?? 0} simulation jobs
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/simulations/new">
            <RiAddLine className="size-4 mr-1" />
            New Simulation
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.simulations ?? []}
        searchPlaceholder="Search simulations..."
        isLoading={isLoading}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its vehicle configurations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
