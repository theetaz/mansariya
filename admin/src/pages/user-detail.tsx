import { useState, useMemo } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MailPlusIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import {
  fetchUserDetail,
  fetchAdminRoles,
  fetchUserSessionsFiltered,
  assignUserRole,
  removeUserRole,
  updateUserStatus,
  deleteUser,
  revokeUserSession,
  revokeAllUserSessions,
  type AdminSession,
  type AdminSessionsParams,
} from "@/lib/api"
import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// ── Status badge ─────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "active": return <Badge variant="default" className="gap-1"><CheckCircle2Icon className="size-3" />Active</Badge>
    case "disabled": return <Badge variant="destructive" className="gap-1"><XCircleIcon className="size-3" />Disabled</Badge>
    case "invited": return <Badge variant="secondary" className="gap-1"><MailPlusIcon className="size-3" />Invited</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

// ── Session columns ──────────────────────────────────────────────────────

const sessionColumns: ColumnDef<AdminSession>[] = [
  {
    accessorKey: "user_agent",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Device / Browser" />,
    cell: ({ row }) => <span className="text-sm">{row.original.user_agent || "Unknown"}</span>,
  },
  {
    accessorKey: "ip_address",
    header: ({ column }) => <DataTableColumnHeader column={column} title="IP Address" />,
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.ip_address}</span>,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.created_at).toLocaleString()}</span>,
  },
  {
    accessorKey: "last_used_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Used" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.last_used_at).toLocaleString()}</span>,
  },
  {
    accessorKey: "expires_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expires" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.expires_at).toLocaleString()}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: ({ row }) => <RevokeButton sessionId={row.original.id} />,
  },
]

function RevokeButton({ sessionId }: { sessionId: string }) {
  const { userId } = useParams()
  const queryClient = useQueryClient()
  const mut = useMutation({
    mutationFn: () => revokeUserSession(userId!, sessionId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-sessions"] }); toast.success("Session revoked") },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => mut.mutate()} disabled={mut.isPending}>
      <Trash2Icon className="size-3" />
    </Button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: !!userId,
  })

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: () => fetchAdminRoles() })
  const allRoles = rolesQuery.data?.roles ?? []

  // Sessions server-side state
  const [sessPagination, setSessPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [sessSorting, setSessSorting] = useState<SortingState>([{ id: "last_used_at", desc: true }])
  const [sessGlobalFilter, setSessGlobalFilter] = useState("")
  const [sessColumnFilters, setSessColumnFilters] = useState<ColumnFiltersState>([])

  const sessParams = useMemo<AdminSessionsParams>(() => ({
    limit: sessPagination.pageSize,
    offset: sessPagination.pageIndex * sessPagination.pageSize,
    search: sessGlobalFilter || undefined,
    sort_by: sessSorting[0]?.id || "last_used_at",
    sort_dir: sessSorting[0]?.desc ? "desc" : "asc",
  }), [sessPagination, sessSorting, sessGlobalFilter])

  const sessQuery = useQuery({
    queryKey: ["user-sessions", userId, sessParams],
    queryFn: () => fetchUserSessionsFiltered(userId!, sessParams),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })

  const sessions = sessQuery.data?.sessions ?? []
  const sessTotal = sessQuery.data?.total ?? 0

  // Mutations
  const isSuperAdmin = user?.roles?.some((r) => r.slug === "super_admin") ?? false

  const toggleStatus = useMutation({
    mutationFn: () => updateUserStatus(userId!, user!.status === "active" ? "disabled" : "active"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-detail"] }); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Status updated") },
    onError: (err: Error) => toast.error(err.message),
  })

  const addRole = useMutation({
    mutationFn: (roleId: string) => assignUserRole(userId!, roleId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-detail"] }); toast.success("Role assigned") },
    onError: (err: Error) => toast.error(err.message),
  })

  const delRole = useMutation({
    mutationFn: (roleId: string) => removeUserRole(userId!, roleId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-detail"] }); toast.success("Role removed") },
    onError: (err: Error) => toast.error(err.message),
  })

  const { user: currentUser, logout } = useAuth()
  const isViewingSelf = currentUser?.id === userId

  const revokeAll = useMutation({
    mutationFn: () => revokeAllUserSessions(userId!),
    onSuccess: async () => {
      if (isViewingSelf) {
        toast.success("All sessions revoked — signing out")
        await logout()
        navigate("/login", { replace: true })
      } else {
        queryClient.invalidateQueries({ queryKey: ["user-sessions"] })
        toast.success("All sessions revoked")
      }
    },
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMut = useMutation({
    mutationFn: () => deleteUser(userId!),
    onSuccess: () => { toast.success("User deleted"); navigate("/users", { replace: true }) },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2Icon className="size-8 animate-spin text-muted-foreground" /></div>
  }
  if (!user) {
    return <div className="flex justify-center py-16 text-muted-foreground">User not found.</div>
  }

  const userRoleSlugs = new Set(user.roles?.map((r) => r.slug) ?? [])
  const availableRoles = allRoles.filter((r) => !userRoleSlugs.has(r.slug))

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/users"><ArrowLeftIcon className="size-4" />Users</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{user.display_name}</span>
      </div>

      {/* User info + actions */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{user.display_name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
              {statusBadge(user.status)}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{user.id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created</p>
              <p className="text-sm">{new Date(user.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last Login</p>
              <p className="text-sm">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Permissions</p>
              <p className="text-sm">{user.permissions?.length ?? 0} granted</p>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: Roles + Actions */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Roles</CardTitle>
                {availableRoles.length > 0 && (
                  <Select onValueChange={(v) => addRole.mutate(v)}>
                    <SelectTrigger className="h-7 w-auto gap-1 border-dashed px-2 text-xs">
                      <SelectValue placeholder="+ Add role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {user.roles?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles assigned.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {user.roles?.map((r) => {
                    const isProtected = isSuperAdmin && r.slug === "super_admin"
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ShieldIcon className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{r.name}</span>
                        </div>
                        {!isProtected && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => delRole.mutate(r.id)}
                          >
                            <XCircleIcon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {user.status !== "invited" && !isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => toggleStatus.mutate()}
                  disabled={toggleStatus.isPending}
                >
                  {user.status === "active"
                    ? <><ShieldOffIcon className="size-3.5" />Deactivate User</>
                    : <><ShieldIcon className="size-3.5" />Activate User</>
                  }
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => revokeAll.mutate()}
                disabled={revokeAll.isPending}
              >
                <Trash2Icon className="size-3.5" />
                Revoke All Sessions
              </Button>
              {!isSuperAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete User
                </Button>
              )}
              {isSuperAdmin && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Super admin accounts cannot be deactivated or deleted.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessions table */}
      <div className="px-0 lg:px-0">
        <DataTable
          columns={sessionColumns}
          data={sessions}
          isLoading={sessQuery.isLoading}
          searchPlaceholder="Search sessions by IP, device..."
          pageSize={10}
          serverSide={{
            rowCount: sessTotal,
            pagination: sessPagination,
            onPaginationChange: setSessPagination,
            sorting: sessSorting,
            onSortingChange: setSessSorting,
            globalFilter: sessGlobalFilter,
            onGlobalFilterChange: setSessGlobalFilter,
            columnFilters: sessColumnFilters,
            onColumnFiltersChange: setSessColumnFilters,
            isFetching: sessQuery.isFetching,
          }}
        />
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{user.display_name}</strong>? All sessions and role assignments will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteMut.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
