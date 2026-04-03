import { useState, useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  TrophyIcon,
  UserIcon,
  CheckCircle2Icon,
  XCircleIcon,
  EyeOffIcon,
} from "lucide-react"

import {
  fetchAdminContributors,
  type AdminContributor,
  type ContributorsParams,
} from "@/lib/api"
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"

// ── Status badge ─────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "claimed":
      return <Badge variant="default" className="gap-1"><CheckCircle2Icon className="size-3" />Claimed</Badge>
    case "anonymous":
      return <Badge variant="secondary" className="gap-1"><EyeOffIcon className="size-3" />Anonymous</Badge>
    case "disabled":
      return <Badge variant="destructive" className="gap-1"><XCircleIcon className="size-3" />Disabled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function qualityBadge(score: number) {
  const rounded = Math.round(score)
  if (rounded >= 80) return <Badge className="bg-emerald-600 hover:bg-emerald-700">{rounded}</Badge>
  if (rounded >= 40) return <Badge className="bg-amber-600 hover:bg-amber-700">{rounded}</Badge>
  if (rounded > 0) return <Badge variant="secondary">{rounded}</Badge>
  return <span className="text-muted-foreground">--</span>
}

// ── Columns ──────────────────────────────────────────────────────────────

const columns: ColumnDef<AdminContributor>[] = [
  {
    accessorKey: "contributor_id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contributor" />,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">
          {row.original.display_name || (
            <span className="text-muted-foreground">
              {row.original.contributor_id.slice(0, 12)}...
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {row.original.contributor_id.slice(0, 16)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => statusBadge(row.original.status),
    meta: {
      filterConfig: {
        type: "select",
        label: "Status",
        options: [
          { value: "anonymous", label: "Anonymous" },
          { value: "claimed", label: "Claimed" },
          { value: "disabled", label: "Disabled" },
        ],
      },
    },
  },
  {
    accessorKey: "total_trips",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trips" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.total_trips}</span>
    ),
  },
  {
    accessorKey: "total_pings",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pings" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.total_pings.toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "quality_score",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Quality" />,
    cell: ({ row }) => qualityBadge(row.original.quality_score),
  },
  {
    accessorKey: "active_days",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Active Days" />,
    cell: ({ row }) => (
      <span className="text-sm">{row.original.active_days || "--"}</span>
    ),
  },
  {
    accessorKey: "last_seen_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Seen" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.last_seen_at
          ? new Date(row.original.last_seen_at).toLocaleDateString()
          : "--"}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="First Seen" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.original.created_at).toLocaleDateString()}
      </span>
    ),
  },
]

// ── Page ─────────────────────────────────────────────────────────────────

export function ContributorsPage() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([{ id: "last_seen_at", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const queryParams = useMemo<ContributorsParams>(() => {
    const p: ContributorsParams = {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    }
    if (globalFilter) p.search = globalFilter
    if (sorting.length > 0) {
      p.sort_by = sorting[0].id
      p.sort_dir = sorting[0].desc ? "desc" : "asc"
    }
    for (const f of columnFilters) {
      if (f.id === "status" && f.value) p.status = f.value as string
    }
    return p
  }, [pagination, sorting, globalFilter, columnFilters])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-contributors", queryParams],
    queryFn: () => fetchAdminContributors(queryParams),
    placeholderData: keepPreviousData,
  })

  const contributors = data?.contributors ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <TrophyIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contributors</h1>
            <p className="text-sm text-muted-foreground">
              {total} device{total !== 1 ? "s" : ""} contributing GPS data.
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 px-4 md:px-6 lg:grid-cols-4">
        <SummaryCard icon={UserIcon} label="Total" value={total} isLoading={isLoading} />
        <SummaryCard icon={CheckCircle2Icon} label="Claimed" value={contributors.filter((c) => c.status === "claimed").length} isLoading={isLoading} />
        <SummaryCard icon={TrophyIcon} label="Top Quality" value={contributors.filter((c) => c.quality_score >= 80).length} isLoading={isLoading} />
        <SummaryCard icon={EyeOffIcon} label="Anonymous" value={contributors.filter((c) => c.status === "anonymous").length} isLoading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        data={contributors}
        isLoading={isLoading}
        searchPlaceholder="Search by contributor ID or display name..."
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

function SummaryCard({ icon: Icon, label, value, isLoading }: {
  icon: React.ElementType; label: string; value: number; isLoading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-tight">
          {isLoading ? "—" : value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
