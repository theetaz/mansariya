import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  PlayIcon,
  PauseIcon,
  SquareIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  CopyIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchSimulations,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  deleteSimulation,
  type SimulationJob,
  type SimulationStatus,
  type SimulationsParams,
} from "@/lib/api"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/* ── status badge mapping ───────────────────────────────────────────── */

const statusBadgeVariant: Record<
  SimulationStatus,
  "outline" | "default" | "secondary" | "destructive"
> = {
  draft: "outline",
  running: "default",
  paused: "secondary",
  stopped: "destructive",
}

/* ── columns ────────────────────────────────────────────────────────── */

function useColumns(): ColumnDef<SimulationJob>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      id: "route",
      accessorFn: (row) => `${row.route_id} ${row.route_name ?? ""}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Route" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <code className="text-xs font-mono text-muted-foreground">
            {row.original.route_id}
          </code>
          {row.original.route_name && (
            <span className="text-sm">{row.original.route_name}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "vehicle_count",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Buses"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.vehicle_count ?? 0}
        </div>
      ),
    },
    {
      accessorKey: "device_count",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Devices"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.device_count ?? 0}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as SimulationStatus
        return (
          <Badge variant={statusBadgeVariant[status]} className="capitalize">
            {status}
          </Badge>
        )
      },
      meta: {
        filterConfig: {
          type: "select" as const,
          label: "Status",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Running", value: "running" },
            { label: "Paused", value: "paused" },
            { label: "Stopped", value: "stopped" },
          ],
        },
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell simulation={row.original} />,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

/* ── action cell ────────────────────────────────────────────────────── */

function ActionsCell({ simulation }: { simulation: SimulationJob }) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["simulations"] })

  const startMut = useMutation({
    mutationFn: () => startSimulation(simulation.id),
    onSuccess: () => {
      toast.success(`Started "${simulation.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(`Failed to start: ${err.message}`),
  })

  const pauseMut = useMutation({
    mutationFn: () => pauseSimulation(simulation.id),
    onSuccess: () => {
      toast.success(`Paused "${simulation.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(`Failed to pause: ${err.message}`),
  })

  const resumeMut = useMutation({
    mutationFn: () => resumeSimulation(simulation.id),
    onSuccess: () => {
      toast.success(`Resumed "${simulation.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(`Failed to resume: ${err.message}`),
  })

  const stopMut = useMutation({
    mutationFn: () => stopSimulation(simulation.id),
    onSuccess: () => {
      toast.success(`Stopped "${simulation.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(`Failed to stop: ${err.message}`),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteSimulation(simulation.id),
    onSuccess: () => {
      toast.success(`Deleted "${simulation.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  })

  const { status } = simulation
  const isTransitioning =
    startMut.isPending ||
    pauseMut.isPending ||
    resumeMut.isPending ||
    stopMut.isPending

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Quick action buttons */}
      {(status === "draft" || status === "stopped") && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          onClick={() => startMut.mutate()}
          disabled={isTransitioning}
          title="Start"
        >
          <PlayIcon className="size-3.5" />
        </Button>
      )}

      {status === "running" && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          onClick={() => pauseMut.mutate()}
          disabled={isTransitioning}
          title="Pause"
        >
          <PauseIcon className="size-3.5" />
        </Button>
      )}

      {status === "paused" && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          onClick={() => resumeMut.mutate()}
          disabled={isTransitioning}
          title="Resume"
        >
          <PlayIcon className="size-3.5" />
        </Button>
      )}

      {(status === "running" || status === "paused") && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => stopMut.mutate()}
          disabled={isTransitioning}
          title="Stop"
        >
          <SquareIcon className="size-3.5" />
        </Button>
      )}

      {/* Dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <EllipsisVerticalIcon className="size-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {(status === "draft" || status === "stopped") && (
            <DropdownMenuItem asChild>
              <Link to={`/simulations/${simulation.id}/edit`}>
                <PencilIcon />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(simulation.id)
              toast.success("Copied simulation ID")
            }}
          >
            <CopyIcon />
            Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={status === "running" || status === "paused"}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{simulation.name}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMut.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ── page ────────────────────────────────────────────────────────────── */

export function SimulationsPage() {
  const columns = useColumns()

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const queryParams = useMemo<SimulationsParams>(() => {
    const p: SimulationsParams = {
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
    queryKey: ["simulations", queryParams],
    queryFn: () => fetchSimulations(queryParams),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
  })

  const simulations = data?.simulations ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulations</h1>
          <p className="text-sm text-muted-foreground">{total} simulation{total !== 1 ? "s" : ""}.</p>
        </div>
        <Button asChild className="w-fit">
          <Link to="/simulations/new"><PlusIcon />New Simulation</Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={simulations}
        isLoading={isLoading}
        searchPlaceholder="Search simulations..."
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
