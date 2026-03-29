import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RiPlayLine,
  RiPauseLine,
  RiStopLine,
  RiEditLine,
  RiDeleteBinLine,
  RiAddLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['simulations'],
    queryFn: fetchSimulations,
    refetchInterval: 5000,
  });

  const startMut = useMutation({ mutationFn: startSimulation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }) });
  const pauseMut = useMutation({ mutationFn: pauseSimulation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }) });
  const resumeMut = useMutation({ mutationFn: resumeSimulation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }) });
  const stopMut = useMutation({ mutationFn: stopSimulation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }) });
  const deleteMut = useMutation({ mutationFn: deleteSimulation, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulations'] }) });

  const simulations = data?.simulations ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulations</h1>
          <p className="text-sm text-muted-foreground">Create and manage simulation jobs</p>
        </div>
        <Button asChild>
          <Link to="/simulations/new">
            <RiAddLine className="mr-2 size-4" />
            New Simulation
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Buses</TableHead>
              <TableHead className="text-right">Devices</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : simulations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No simulations yet. Create one to get started.</TableCell>
              </TableRow>
            ) : (
              simulations.map((sim: SimulationJob) => (
                <TableRow key={sim.id}>
                  <TableCell className="font-medium">{sim.name}</TableCell>
                  <TableCell>{sim.route_name ?? sim.route_id}</TableCell>
                  <TableCell className="text-right">{sim.vehicle_count ?? 0}</TableCell>
                  <TableCell className="text-right">{sim.device_count ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[sim.status].variant}>
                      {statusConfig[sim.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {sim.status === 'draft' || sim.status === 'stopped' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startMut.mutate(sim.id)} title="Start">
                            <RiPlayLine className="size-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" asChild title="Edit">
                            <Link to={`/simulations/${sim.id}/edit`}>
                              <RiEditLine className="size-4 text-blue-500" />
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(sim.id)} title="Delete">
                            <RiDeleteBinLine className="size-4 text-red-500" />
                          </Button>
                        </>
                      ) : sim.status === 'running' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => pauseMut.mutate(sim.id)} title="Pause">
                            <RiPauseLine className="size-4 text-amber-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => stopMut.mutate(sim.id)} title="Stop">
                            <RiStopLine className="size-4 text-red-500" />
                          </Button>
                        </>
                      ) : sim.status === 'paused' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => resumeMut.mutate(sim.id)} title="Resume">
                            <RiPlayLine className="size-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => stopMut.mutate(sim.id)} title="Stop">
                            <RiStopLine className="size-4 text-red-500" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
