import { useState, useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Loader2Icon,
  SearchIcon,
  SearchXIcon,
  ShieldIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XCircleIcon,
} from "lucide-react"

import {
  fetchAuditLogs,
  type AuditEntry,
  type AuditLogsParams,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Action badge ─────────────────────────────────────────────────────────

function actionBadge(action: string) {
  if (action === "auth.login")
    return <Badge className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap">{action}</Badge>
  if (action === "auth.login_failed")
    return <Badge variant="destructive" className="whitespace-nowrap">{action}</Badge>
  if (action === "auth.logout")
    return <Badge variant="secondary" className="whitespace-nowrap">{action}</Badge>
  if (action.startsWith("auth."))
    return <Badge className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap">{action}</Badge>
  if (action.startsWith("user."))
    return <Badge className="bg-violet-600 hover:bg-violet-700 whitespace-nowrap">{action}</Badge>
  if (action.startsWith("role."))
    return <Badge className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">{action}</Badge>
  return <Badge variant="outline" className="whitespace-nowrap">{action}</Badge>
}

// ── Sortable header ──────────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  sorting,
  onSort,
}: {
  label: string
  field: string
  sorting: SortingState
  onSort: (field: string) => void
}) {
  const current = sorting.find((s) => s.id === field)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1"
      onClick={() => onSort(field)}
    >
      {label}
      {!current && <ArrowUpDownIcon className="size-3 opacity-50" />}
      {current?.desc === false && <ArrowUpIcon className="size-3" />}
      {current?.desc === true && <ArrowDownIcon className="size-3" />}
    </Button>
  )
}

// ── Columns ──────────────────────────────────────────────────────────────

const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "created_at",
    header: "Time",
    cell: ({ row }) => {
      const d = new Date(row.original.created_at)
      return (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
          {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )
    },
  },
  {
    accessorKey: "actor_email",
    header: "Actor",
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.actor_email || "System"}</p>
        {row.original.actor_id && (
          <p className="text-xs text-muted-foreground">{row.original.actor_id.slice(0, 8)}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => actionBadge(row.original.action),
  },
  {
    accessorKey: "target_type",
    header: "Target",
    cell: ({ row }) =>
      row.original.target_type && row.original.target_id ? (
        <div>
          <span className="text-sm font-medium">{row.original.target_type}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {row.original.target_id.slice(0, 12)}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">--</span>
      ),
  },
  {
    accessorKey: "ip_address",
    header: "IP Address",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.ip_address || "--"}
      </span>
    ),
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => {
      const meta = row.original.metadata
      if (!meta || Object.keys(meta).length === 0) return <span className="text-muted-foreground">--</span>
      return (
        <div className="flex flex-wrap gap-1">
          {Object.entries(meta).map(([key, value]) => (
            <span key={key} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {key}={String(value)}
            </span>
          ))}
        </div>
      )
    },
  },
]

// ── Action filter options ────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: "__all__", label: "All Actions" },
  { value: "auth.login", label: "Login" },
  { value: "auth.login_failed", label: "Login Failed" },
  { value: "auth.logout", label: "Logout" },
  { value: "auth.invite_accepted", label: "Invite Accepted" },
  { value: "auth.password_reset", label: "Password Reset" },
  { value: "auth.session_revoked", label: "Session Revoked" },
  { value: "user.invited", label: "User Invited" },
  { value: "user.status_changed", label: "Status Changed" },
  { value: "role.assigned", label: "Role Assigned" },
  { value: "role.removed", label: "Role Removed" },
  { value: "role.created", label: "Role Created" },
  { value: "role.permissions_updated", label: "Permissions Updated" },
]

const TARGET_OPTIONS = [
  { value: "__all__", label: "All Targets" },
  { value: "user", label: "User" },
  { value: "role", label: "Role" },
  { value: "session", label: "Session" },
]

// ── Page ─────────────────────────────────────────────────────────────────

export function AuditLogsPage() {
  // Server-side state
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("__all__")
  const [targetFilter, setTargetFilter] = useState("__all__")

  // Build query params from state
  const queryParams = useMemo<AuditLogsParams>(() => ({
    search: search || undefined,
    action: actionFilter !== "__all__" ? actionFilter : undefined,
    target_type: targetFilter !== "__all__" ? targetFilter : undefined,
    sort_by: sorting[0]?.id || "created_at",
    sort_dir: sorting[0]?.desc ? "desc" : "asc",
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  }), [search, actionFilter, targetFilter, sorting, pagination])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => fetchAuditLogs(queryParams),
    placeholderData: keepPreviousData,
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const pageCount = Math.ceil(total / pagination.pageSize)

  // TanStack Table in manual (server-side) mode
  const table = useReactTable({
    data: entries,
    columns,
    pageCount,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  const hasFilters = search || actionFilter !== "__all__" || targetFilter !== "__all__"

  function clearFilters() {
    setSearch("")
    setActionFilter("__all__")
    setTargetFilter("__all__")
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  function handleSort(field: string) {
    setSorting((prev) => {
      const current = prev.find((s) => s.id === field)
      if (!current) return [{ id: field, desc: true }]
      if (current.desc) return [{ id: field, desc: false }]
      return [{ id: "created_at", desc: true }] // reset to default
    })
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      {/* Header */}
      <div className="px-4 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldIcon className="size-6" />
          Audit Trail
        </h1>
        <p className="text-sm text-muted-foreground">
          Server-side filtered, sorted, and paginated audit history.
          {!isLoading && <span className="ml-1">{total} total entries.</span>}
        </p>
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-6">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search actor, action, IP, target..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            className="h-9 rounded-xl bg-card pl-10 shadow-sm"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })) }}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetFilter} onValueChange={(v) => { setTargetFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })) }}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={clearFilters}>
            <XCircleIcon className="size-3.5" />
            Clear
          </Button>
        )}
        {isFetching && !isLoading && (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Table */}
      <div className="mx-4 md:mx-6">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead>
                      <SortableHeader label="Time" field="created_at" sorting={sorting} onSort={handleSort} />
                    </TableHead>
                    <TableHead>
                      <SortableHeader label="Actor" field="actor_email" sorting={sorting} onSort={handleSort} />
                    </TableHead>
                    <TableHead>
                      <SortableHeader label="Action" field="action" sorting={sorting} onSort={handleSort} />
                    </TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>
                      <SortableHeader label="IP Address" field="ip_address" sorting={sorting} onSort={handleSort} />
                    </TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-full">
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                          <SearchXIcon className="size-10 opacity-30" />
                          <p className="text-sm font-medium">No matching entries</p>
                          <p className="text-xs">Try adjusting your search or filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            {total > 0
              ? `Showing ${pagination.pageIndex * pagination.pageSize + 1}–${Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of ${total}`
              : "No entries"}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-sm">Rows</Label>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}
              >
                <SelectTrigger className="h-8 w-[70px]" id="page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm">
              Page {pagination.pageIndex + 1} of {pageCount || 1}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPagination((p) => ({ ...p, pageIndex: 0 }))} disabled={pagination.pageIndex === 0}>
                <ChevronsLeftIcon className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))} disabled={pagination.pageIndex === 0}>
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))} disabled={pagination.pageIndex >= pageCount - 1}>
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={() => setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }))} disabled={pagination.pageIndex >= pageCount - 1}>
                <ChevronsRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
