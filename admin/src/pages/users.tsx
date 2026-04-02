import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  Loader2Icon,
  MailPlusIcon,
  MonitorIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
  UserPlusIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAdminUsers,
  fetchAdminRoles,
  fetchUserSessions,
  inviteUser,
  updateUserStatus,
  assignUserRole,
  removeUserRole,
  revokeUserSession,
  revokeAllUserSessions,
  type AdminUser,
  type AdminRole,
  type AdminUsersParams,
} from "@/lib/api"
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Status badge ─────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="gap-1"><CheckCircle2Icon className="size-3" />Active</Badge>
    case "disabled":
      return <Badge variant="destructive" className="gap-1"><XCircleIcon className="size-3" />Disabled</Badge>
    case "invited":
      return <Badge variant="secondary" className="gap-1"><MailPlusIcon className="size-3" />Invited</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ── Invite dialog ────────────────────────────────────────────────────────

function InviteDialog({ roles }: { roles: AdminRole[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [roleId, setRoleId] = useState("")

  const mutation = useMutation({
    mutationFn: () => inviteUser(email, displayName, roleId ? [roleId] : []),
    onSuccess: (data) => {
      toast.success(`Invited ${email}`, { description: `Token: ${data.invite_token.slice(0, 16)}...` })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setOpen(false)
      setEmail(""); setDisplayName(""); setRoleId("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><UserPlusIcon className="size-4" />Invite User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Operator</DialogTitle>
          <DialogDescription>Send an invitation to a new operator user.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@mansariya.lk" />
          </div>
          <div className="grid gap-2">
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full Name" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!email || !displayName || mutation.isPending}>
            {mutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Sessions dialog ──────────────────────────────────────────────────────

function SessionsDialog({ userId, displayName }: { userId: string; displayName: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const sessionsQuery = useQuery({ queryKey: ["user-sessions", userId], queryFn: () => fetchUserSessions(userId), enabled: open })
  const revoke = useMutation({ mutationFn: (sid: string) => revokeUserSession(userId, sid), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-sessions", userId] }); toast.success("Session revoked") } })
  const revokeAll = useMutation({ mutationFn: () => revokeAllUserSessions(userId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-sessions", userId] }); toast.success("All sessions revoked") } })
  const sessions = sessionsQuery.data?.sessions ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" className="gap-1"><MonitorIcon className="size-3" />Sessions</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Active Sessions — {displayName}</DialogTitle>
          <DialogDescription>{sessions.length} active session{sessions.length !== 1 ? "s" : ""}.</DialogDescription>
        </DialogHeader>
        {sessionsQuery.isLoading ? (
          <div className="flex justify-center py-4"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /></div>
        ) : sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.user_agent || "Unknown device"}</p>
                  <p className="text-xs text-muted-foreground">{s.ip_address} — {new Date(s.last_used_at).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => revoke.mutate(s.id)}><Trash2Icon className="size-3" /></Button>
              </div>
            ))}
          </div>
        )}
        {sessions.length > 0 && <DialogFooter><Button variant="destructive" size="sm" onClick={() => revokeAll.mutate()}>Revoke All</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ── Role pills (inline) ─────────────────────────────────────────────────

function RolePills({ user, allRoles }: { user: AdminUser; allRoles: AdminRole[] }) {
  const queryClient = useQueryClient()
  const addRole = useMutation({ mutationFn: (rid: string) => assignUserRole(user.id, rid), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role assigned") } })
  const delRole = useMutation({ mutationFn: (rid: string) => removeUserRole(user.id, rid), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role removed") } })
  const userSlugs = new Set(user.roles.map((r) => r.slug))
  const available = allRoles.filter((r) => !userSlugs.has(r.slug))

  return (
    <div className="flex flex-wrap gap-1">
      {user.roles.map((r) => (
        <Badge key={r.id} variant="outline" className="gap-1 text-xs">
          <ShieldIcon className="size-3" />{r.name}
          <button onClick={() => delRole.mutate(r.id)} className="ml-0.5 rounded hover:text-destructive"><XCircleIcon className="size-3" /></button>
        </Badge>
      ))}
      {available.length > 0 && (
        <Select onValueChange={(v) => addRole.mutate(v)}>
          <SelectTrigger className="h-6 w-auto gap-1 border-dashed px-2 text-xs"><SelectValue placeholder="+ Role" /></SelectTrigger>
          <SelectContent>{available.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  )
}

// ── Action buttons ───────────────────────────────────────────────────────

function UserActions({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => updateUserStatus(user.id, user.status === "active" ? "disabled" : "active"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(`User ${user.status === "active" ? "disabled" : "enabled"}`) },
  })

  return (
    <div className="flex items-center gap-1">
      <SessionsDialog userId={user.id} displayName={user.display_name} />
      {user.status !== "invited" && (
        <Button variant={user.status === "active" ? "outline" : "default"} size="sm" className="gap-1" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
          {user.status === "active" ? <><ShieldOffIcon className="size-3" />Disable</> : <><ShieldIcon className="size-3" />Enable</>}
        </Button>
      )}
    </div>
  )
}

// ── Columns ──────────────────────────────────────────────────────────────

function makeColumns(allRoles: AdminRole[]): ColumnDef<AdminUser>[] {
  return [
    {
      accessorKey: "display_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.display_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
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
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
            { value: "invited", label: "Invited" },
          ],
        },
      },
    },
    {
      id: "roles",
      header: "Roles",
      cell: ({ row }) => <RolePills user={row.original} allRoles={allRoles} />,
      enableSorting: false,
    },
    {
      accessorKey: "last_login_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Login" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.last_login_at ? new Date(row.original.last_login_at).toLocaleDateString() : "Never"}
        </span>
      ),
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
      cell: ({ row }) => <UserActions user={row.original} />,
      enableSorting: false,
    },
  ]
}

// ── Page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const queryParams = useMemo<AdminUsersParams>(() => {
    const p: AdminUsersParams = {
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
    queryKey: ["admin-users", queryParams],
    queryFn: () => fetchAdminUsers(queryParams),
    placeholderData: keepPreviousData,
  })

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: fetchAdminRoles })
  const roles = rolesQuery.data?.roles ?? []
  const users = data?.users ?? []
  const total = data?.total ?? 0

  const columns = useMemo(() => makeColumns(roles), [roles])

  return (
    <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {total} operator account{total !== 1 ? "s" : ""}.
          </p>
        </div>
        <InviteDialog roles={roles} />
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchPlaceholder="Search users by name or email..."
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
