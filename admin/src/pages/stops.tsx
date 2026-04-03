import { useState, useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  MapPinIcon,
  PlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from "lucide-react"

import { fetchAdminStops, type AdminStopView, type AdminStopsParams } from "@/lib/api"
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
  crowdsourced: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  geocoded: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  manual: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  ntc_geocoded: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const cls = pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500"
  return <span className={`text-sm font-medium ${cls}`}>{pct}%</span>
}

// ── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<AdminStopView>[] = [
  {
    accessorKey: "name_en",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stop Name" />,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name_en}</p>
        {row.original.name_si && (
          <p className="text-xs text-muted-foreground">{row.original.name_si}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "source",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
    cell: ({ row }) => (
      <Badge variant="outline" className={sourceBadgeClass[row.original.source] ?? ""}>
        {row.original.source}
      </Badge>
    ),
    meta: {
      filterConfig: {
        type: "select",
        label: "Source",
        options: [
          { label: "NTC Geocoded", value: "ntc_geocoded" },
          { label: "OSM", value: "OSM" },
          { label: "Crowdsourced", value: "crowdsourced" },
          { label: "Manual", value: "manual" },
          { label: "Geocoded", value: "geocoded" },
        ],
      },
    },
  },
  {
    accessorKey: "confidence",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Confidence" />,
    cell: ({ row }) => <ConfidenceBadge value={row.original.confidence} />,
  },
  {
    accessorKey: "observation_count",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Observations" className="text-right" />,
    cell: ({ row }) => <div className="text-right font-mono text-sm">{row.original.observation_count}</div>,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.original.created_at).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-8 p-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><EyeIcon className="mr-2 size-4" />View details</DropdownMenuItem>
          <DropdownMenuItem><PencilIcon className="mr-2 size-4" />Edit stop</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive"><TrashIcon className="mr-2 size-4" />Delete stop</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

// ── Page ────────────────────────────────────────────────────────────────

export function StopsPage() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const queryParams = useMemo<AdminStopsParams>(() => {
    const p: AdminStopsParams = {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    }
    if (globalFilter) p.search = globalFilter
    if (sorting.length > 0) {
      p.sort_by = sorting[0].id
      p.sort_dir = sorting[0].desc ? "desc" : "asc"
    }
    for (const f of columnFilters) {
      if (f.id === "source" && f.value) p.source = f.value as string
    }
    return p
  }, [pagination, sorting, globalFilter, columnFilters])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-stops", queryParams],
    queryFn: () => fetchAdminStops(queryParams),
    placeholderData: keepPreviousData,
  })

  const stops = data?.stops ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <MapPinIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Stops</h1>
            <p className="text-sm text-muted-foreground">{total} stops registered.</p>
          </div>
        </div>
        <Button className="mt-3 sm:mt-0"><PlusIcon className="mr-2 size-4" />Add Stop</Button>
      </div>

      <DataTable
        columns={columns}
        data={stops}
        isLoading={isLoading}
        searchPlaceholder="Search stops by name..."
        pageSize={15}
        serverSide={{
          rowCount: total,
          pagination,
          onPaginationChange: setPagination,
          sorting,
          onSortingChange: setSorting,
          globalFilter,
          onGlobalFilterChange: setGlobalFilter,
          columnFilters,
          onColumnFiltersChange: setColumnFilters,
          isFetching,
        }}
      />
    </div>
  )
}
