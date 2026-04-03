import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  EllipsisVerticalIcon,
  EyeIcon,
  Loader2Icon,
  MailPlusIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
  UserPlusIcon,
  XCircleIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import {
  fetchAdminUsers,
  fetchAdminRoles,
  inviteUser,
  updateUserStatus,
  deleteUser,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

// ── Row actions dropdown ─────────────────────────────────────────────────

function UserRowActions({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isSuperAdmin = user.roles?.some((r) => r.slug === "super_admin") ?? false

  const toggle = useMutation({
    mutationFn: () => updateUserStatus(user.id, user.status === "active" ? "disabled" : "active"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(`User ${user.status === "active" ? "disabled" : "enabled"}`) },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User deleted") },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8 p-0">
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
          <EyeIcon className="mr-2 size-4" />View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
          <ShieldIcon className="mr-2 size-4" />Manage Roles
        </DropdownMenuItem>
        {user.status !== "invited" && (
          <DropdownMenuItem onClick={() => toggle.mutate()}>
            {user.status === "active"
              ? <><ShieldOffIcon className="mr-2 size-4" />Deactivate</>
              : <><ShieldIcon className="mr-2 size-4" />Activate</>
            }
          </DropdownMenuItem>
        )}
        {!isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => deleteMut.mutate()}>
              <Trash2Icon className="mr-2 size-4" />Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Columns ──────────────────────────────────────────────────────────────

function makeColumns(): ColumnDef<AdminUser>[] {
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
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles?.map((r) => (
            <Badge key={r.id} variant="outline" className="gap-1 text-xs">
              <ShieldIcon className="size-3" />{r.name}
            </Badge>
          ))}
        </div>
      ),
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
      enableSorting: false,
      cell: ({ row }) => <UserRowActions user={row.original} />,
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

  const rolesQuery = useQuery({ queryKey: ["admin-roles"], queryFn: () => fetchAdminRoles() })
  const roles = rolesQuery.data?.roles ?? []
  const users = data?.users ?? []
  const total = data?.total ?? 0

  const columns = useMemo(() => makeColumns(), [])

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
