import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { CheckIcon, XIcon, PlusIcon, EllipsisVerticalIcon } from "lucide-react"
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
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <a
          href={`/routes/${row.original.id}`}
          className="font-mono text-xs text-primary underline-offset-4 hover:underline"
        >
          {row.original.id.slice(0, 8)}
        </a>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name_en",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.original.name_en}</span>
          {row.original.name_si && (
            <span className="text-xs text-muted-foreground">
              {row.original.name_si}
            </span>
          )}
        </div>
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
      cell: ({ row }) => row.original.service_type,
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
          Rs. {row.original.fare_lkr.toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: "stop_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Stops" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.stop_count}</span>
      ),
    },
    {
      accessorKey: "has_polyline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Polyline" />
      ),
      cell: ({ row }) =>
        row.original.has_polyline ? (
          <CheckIcon className="size-4 text-emerald-600" />
        ) : (
          <XIcon className="size-4 text-muted-foreground/50" />
        ),
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Active" />
      ),
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
          options: [
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ],
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
                <a href={`/routes/${route.id}`}>View</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/routes/${route.id}/edit`}>Edit</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleActive(route)}
              >
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

// ── Page ─────────────────────────────────────────────────────────────────

export function RoutesPage() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmState>(CLOSED)

  // ── Queries & mutations ───────────────────────────────────────────────

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

  // ── Action handlers ───────────────────────────────────────────────────

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

  // ── Derived metrics ───────────────────────────────────────────────────

  const totalRoutes = routes.length
  const activeRoutes = routes.filter((r) => r.is_active).length
  const withPolyline = routes.filter((r) => r.has_polyline).length
  const withStops = routes.filter((r) => r.stop_count > 0).length

  const columns = makeColumns(handleToggleActive, handleDelete)

  // ── Render ────────────────────────────────────────────────────────────

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
        <a href="/routes/new">
          <Button>
            <PlusIcon className="mr-1 size-4" />
            Add Route
          </Button>
        </a>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Routes</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? "--" : totalRoutes}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Active Routes</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? "--" : activeRoutes}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>With Polyline</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? "--" : withPolyline}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>With Stops</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {isLoading ? "--" : withStops}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={routes}
        isLoading={isLoading}
        searchPlaceholder="Search routes by name, operator..."
        pageSize={15}
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
