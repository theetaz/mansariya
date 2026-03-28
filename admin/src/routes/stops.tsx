import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { RiMoreLine, RiAddLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumnHeader } from '@/components/shared/data-table';
import type { Stop } from '@/lib/types';

export const Route = createFileRoute('/stops')({
  component: StopsPage,
});

function StopsPage() {
  // Use the sync endpoint which returns routes with stops
  const { data, isLoading } = useQuery({
    queryKey: ['stops-nearby'],
    queryFn: () =>
      fetch('/api/v1/stops/nearby?lat=7.0&lng=80.0&radius_km=500')
        .then((r) => r.json())
        .then((d: Stop[]) => d),
    staleTime: 60_000,
  });

  const stops = data ?? [];

  const columns: ColumnDef<Stop>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
    },
    {
      accessorKey: 'name_en',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name (EN)" />,
      cell: ({ row }) => (
        <div className="max-w-[250px]">
          <div className="font-medium truncate">{row.original.name_en || '—'}</div>
        </div>
      ),
    },
    {
      accessorKey: 'name_si',
      header: 'Name (SI)',
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[150px] block">{row.original.name_si || '—'}</span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const loc = row.original.location;
        return loc ? (
          <span className="font-mono text-xs">{loc[1].toFixed(4)}, {loc[0].toFixed(4)}</span>
        ) : '—';
      },
    },
    {
      accessorKey: 'source',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.source || '—'}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'select',
          label: 'Source',
          options: [
            { label: 'NTC', value: 'NTC' },
            { label: 'OSM', value: 'OSM' },
            { label: 'Crowdsourced', value: 'crowdsourced' },
            { label: 'Manual', value: 'manual' },
          ],
        },
      },
    },
    {
      accessorKey: 'confidence',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Confidence" className="text-right" />,
      cell: ({ row }) => {
        const conf = row.original.confidence;
        const label = conf >= 0.8 ? 'High' : conf >= 0.5 ? 'Medium' : 'Low';
        const variant = conf >= 0.8 ? 'default' : conf >= 0.5 ? 'secondary' : 'outline';
        return (
          <div className="text-right">
            <Badge variant={variant as 'default' | 'secondary' | 'outline'} className="text-xs">
              {label}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'observation_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Observations" className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.observation_count}</div>
      ),
    },
    {
      id: 'actions',
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8" size="icon">
              <RiMoreLine />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>View on Map</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Stops</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stops.length} stops in the database
          </p>
        </div>
        <Button size="sm">
          <RiAddLine className="size-4 mr-1" />
          Add Stop
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={stops}
        searchPlaceholder="Search stops..."
        isLoading={isLoading}
      />
    </div>
  );
}
