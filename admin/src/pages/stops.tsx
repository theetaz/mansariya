import { type ColumnDef } from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  MapPinIcon,
  PlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from "lucide-react"

import { fetchNearbyStops, type Stop } from "@/lib/api"
import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ── Source badge colours ────────────────────────────────────────────────

const sourceBadgeClass: Record<string, string> = {
  NTC: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  OSM: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  crowdsourced:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  manual:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
}

// ── Confidence badge ────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.8) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        High
      </Badge>
    )
  }
  if (value >= 0.5) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
        Medium
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      Low
    </Badge>
  )
}

// ── Columns ─────────────────────────────────────────────────────────────

const columns: ColumnDef<Stop>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.id.slice(0, 8)}
      </span>
    ),
  },
  {
    accessorKey: "name_en",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name EN" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name_en}</span>
    ),
  },
  {
    accessorKey: "name_si",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name SI" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.name_si || "-"}</span>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
    enableSorting: false,
    cell: ({ row }) => {
      const [lat, lng] = row.original.location
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      )
    },
  },
  {
    accessorKey: "source",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => {
      const source = row.original.source
      return (
        <Badge
          variant="outline"
          className={sourceBadgeClass[source] ?? ""}
        >
          {source}
        </Badge>
      )
    },
    meta: {
      filterConfig: {
        type: "select",
        label: "Source",
        options: [
          { label: "NTC", value: "NTC" },
          { label: "OSM", value: "OSM" },
          { label: "Crowdsourced", value: "crowdsourced" },
          { label: "Manual", value: "manual" },
        ],
      },
    },
  },
  {
    accessorKey: "confidence",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Confidence" />
    ),
    cell: ({ row }) => <ConfidenceBadge value={row.original.confidence} />,
  },
  {
    accessorKey: "observation_count",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Observations"
        className="text-right"
      />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {row.original.observation_count}
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <EyeIcon className="mr-2 size-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PencilIcon className="mr-2 size-4" />
            Edit stop
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <TrashIcon className="mr-2 size-4" />
            Delete stop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

// ── Page ────────────────────────────────────────────────────────────────

export function StopsPage() {
  const { data: stops, isLoading } = useQuery({
    queryKey: ["stops-nearby"],
    queryFn: fetchNearbyStops,
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <MapPinIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Stops</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${stops?.length ?? 0} stops registered`}
            </p>
          </div>
        </div>
        <Button className="mt-3 sm:mt-0">
          <PlusIcon className="mr-2 size-4" />
          Add Stop
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={stops ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search stops by name, source..."
      />
    </div>
  )
}
