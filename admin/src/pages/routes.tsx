import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  BusFrontIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  RouteIcon,
  ActivityIcon,
  MapPinIcon,
  SplineIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAdminRoutes,
  deleteRoute,
  setRouteActive,
  type AdminRouteWithStats,
} from "@/lib/api"
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table"
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

// ── Confirm dialog state ────────────────────────────────────────────────

type ConfirmState =
  | { open: false }
  | {
      open: true
      title: string
      description: string
      action: () => void
      variant: "default" | "destructive"
      actionLabel: string
    }

const CLOSED: ConfirmState = { open: false }

// ── Columns ─────────────────────────────────────────────────────────────

function makeColumns(
  onToggleActive: (route: AdminRouteWithStats) => void,
  onDelete: (route: AdminRouteWithStats) => void
): ColumnDef<AdminRouteWithStats>[] {
  return [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Route" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/routes/${row.original.id}`}
          className="flex items-center gap-2 hover:underline underline-offset-4"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <BusFrontIcon className="size-3.5 text-primary" />
          </div>
          <span className="font-mono text-xs font-semibold text-primary">
            {row.original.id}
          </span>
        </Link>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name_en",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <Link
          to={`/routes/${row.original.id}`}
          className="block max-w-[280px] hover:underline underline-offset-4"
        >
          <span className="font-medium truncate block">
            {row.original.name_en || "—"}
          </span>
          {row.original.name_si && (
            <span className="text-xs text-muted-foreground truncate block">
              {row.original.name_si}
            </span>
          )}
        </Link>
      ),
    },
    {
      accessorKey: "operator",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Operator" />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.operator}</Badge>
      ),
      meta: {
        filterConfig: {
          type: "select",
          label: "Operator",
          options: [
            { label: "SLTB", value: "SLTB" },
            { label: "Private", value: "Private" },
          ],
        },
      },
    },
    {
      accessorKey: "service_type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Service" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.service_type || "—"}</span>
      ),
      meta: {
        filterConfig: {
          type: "select",
          label: "Service Type",
          options: [
            { label: "Normal", value: "Normal" },
            { label: "Semi-Luxury", value: "Semi-Luxury" },
            { label: "Luxury", value: "Luxury" },
            { label: "Express", value: "Express" },
          ],
        },
      },
    },
    {
      accessorKey: "fare_lkr",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Fare"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.fare_lkr ? `Rs. ${row.original.fare_lkr.toLocaleString()}` : "—"}
        </div>
      ),
    },
    {
      accessorKey: "stop_count",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Stops"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.stop_count}</div>
      ),
    },
    {
      accessorKey: "has_polyline",
      header: "Polyline",
      cell: ({ row }) =>
        row.original.has_polyline ? (
          <CheckIcon className="size-4 text-emerald-500" />
        ) : (
          <XIcon className="size-4 text-muted-foreground/40" />
        ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) =>
        row.original.is_active ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
      meta: {
        filterConfig: {
          type: "boolean",
          label: "Active",
        },
      },
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const route = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <EllipsisVerticalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link to={`/routes/${route.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/routes/${route.id}/edit`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleActive(route)}>
                {route.is_active ? "Inactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(route)}
              >
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}

// ── Metric card ─────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  isLoading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
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

// ── Page ─────────────────────────────────────────────────────────────────

export function RoutesPage() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmState>(CLOSED)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: fetchAdminRoutes,
  })

  const routes = data?.routes ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] })
      toast.success("Route deleted successfully")
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete route: ${err.message}`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setRouteActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] })
      toast.success("Route status updated")
    },
    onError: (err: Error) => {
      toast.error(`Failed to update status: ${err.message}`)
    },
  })

  function handleToggleActive(route: AdminRouteWithStats) {
    const next = !route.is_active
    setConfirm({
      open: true,
      title: next ? "Activate Route" : "Inactivate Route",
      description: next
        ? `Are you sure you want to activate "${route.name_en}"? It will become visible to users.`
        : `Are you sure you want to inactivate "${route.name_en}"? It will be hidden from users.`,
      actionLabel: next ? "Activate" : "Inactivate",
      variant: "default",
      action: () => {
        statusMutation.mutate({ id: route.id, isActive: next })
        setConfirm(CLOSED)
      },
    })
  }

  function handleDelete(route: AdminRouteWithStats) {
    setConfirm({
      open: true,
      title: "Delete Route",
      description: `This will permanently delete "${route.name_en}" and all associated data. This action cannot be undone.`,
      actionLabel: "Delete Permanently",
      variant: "destructive",
      action: () => {
        deleteMutation.mutate(route.id)
        setConfirm(CLOSED)
      },
    })
  }

  const totalRoutes = routes.length
  const activeRoutes = routes.filter((r) => r.is_active).length
  const withPolyline = routes.filter((r) => r.has_polyline).length
  const withStops = routes.filter((r) => r.stop_count > 0).length

  const columns = makeColumns(handleToggleActive, handleDelete)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Route management</Badge>
            <Badge variant="secondary">{activeRoutes} active</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Routes</h1>
          <p className="text-sm text-muted-foreground">
            {totalRoutes} routes in the system
          </p>
        </div>
        <Link to="/routes/new">
          <Button>
            <PlusIcon className="mr-1 size-4" />
            Add Route
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 px-4 lg:px-6 xl:grid-cols-4">
        <MetricCard
          icon={RouteIcon}
          label="Total Routes"
          value={totalRoutes}
          isLoading={isLoading}
        />
        <MetricCard
          icon={ActivityIcon}
          label="Active Routes"
          value={activeRoutes}
          isLoading={isLoading}
        />
        <MetricCard
          icon={SplineIcon}
          label="With Polyline"
          value={withPolyline}
          isLoading={isLoading}
        />
        <MetricCard
          icon={MapPinIcon}
          label="With Stops"
          value={withStops}
          isLoading={isLoading}
        />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={routes}
        isLoading={isLoading}
        searchPlaceholder="Search routes by name, operator..."
        pageSize={10}
      />

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirm.open}
        onOpenChange={(open) => {
          if (!open) setConfirm(CLOSED)
        }}
      >
        {confirm.open && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirm.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={confirm.variant}
                onClick={confirm.action}
              >
                {confirm.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
