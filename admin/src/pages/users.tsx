import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  Loader2Icon,
  MailPlusIcon,
  ShieldIcon,
  ShieldOffIcon,
  UserPlusIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAdminUsers,
  fetchAdminRoles,
  inviteUser,
  updateUserStatus,
  assignUserRole,
  removeUserRole,
  type AdminUser,
  type AdminRole,
} from "@/lib/api"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

function InviteDialog({ roles }: { roles: AdminRole[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [roleId, setRoleId] = useState("")

  const mutation = useMutation({
    mutationFn: () => inviteUser(email, displayName, roleId ? [roleId] : []),
    onSuccess: (data) => {
      toast.success(`Invited ${email}`, {
        description: `Invite token: ${data.invite_token.slice(0, 16)}...`,
      })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setOpen(false)
      setEmail("")
      setDisplayName("")
      setRoleId("")
    },
    onError: () => toast.error("Failed to invite user"),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlusIcon className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Operator</DialogTitle>
          <DialogDescription>
            Send an invitation to a new operator user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@mansariya.lk" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-name">Display Name</Label>
            <Input id="inv-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full Name" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!email || !displayName || mutation.isPending}>
            {mutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserRow({ user, roles }: { user: AdminUser; roles: AdminRole[] }) {
  const queryClient = useQueryClient()

  const toggleStatus = useMutation({
    mutationFn: () => updateUserStatus(user.id, user.status === "active" ? "disabled" : "active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success(`User ${user.status === "active" ? "disabled" : "enabled"}`)
    },
  })

  const addRole = useMutation({
    mutationFn: (roleId: string) => assignUserRole(user.id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Role assigned")
    },
  })

  const delRole = useMutation({
    mutationFn: (roleId: string) => removeUserRole(user.id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Role removed")
    },
  })

  const userRoleSlugs = new Set(user.roles.map((r) => r.slug))
  const availableRoles = roles.filter((r) => !userRoleSlugs.has(r.slug))

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{user.display_name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </TableCell>
      <TableCell>{statusBadge(user.status)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <Badge key={r.id} variant="outline" className="gap-1 text-xs">
              <ShieldIcon className="size-3" />
              {r.name}
              <button
                onClick={() => delRole.mutate(r.id)}
                className="ml-0.5 rounded hover:text-destructive"
                title="Remove role"
              >
                <XCircleIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {availableRoles.length > 0 && (
            <Select onValueChange={(v) => addRole.mutate(v)}>
              <SelectTrigger className="h-6 w-auto gap-1 border-dashed px-2 text-xs">
                <SelectValue placeholder="+ Role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.last_login_at
          ? new Date(user.last_login_at).toLocaleDateString()
          : "Never"}
      </TableCell>
      <TableCell>
        {user.status !== "invited" && (
          <Button
            variant={user.status === "active" ? "outline" : "default"}
            size="sm"
            className="gap-1"
            onClick={() => toggleStatus.mutate()}
            disabled={toggleStatus.isPending}
          >
            {user.status === "active"
              ? <><ShieldOffIcon className="size-3" />Disable</>
              : <><ShieldIcon className="size-3" />Enable</>
            }
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

export function UsersPage() {
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  })

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRoles,
  })

  const users = usersQuery.data?.users ?? []
  const roles = rolesQuery.data?.roles ?? []

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage operator accounts, roles, and access.
          </p>
        </div>
        <InviteDialog roles={roles} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operator Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""} registered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} roles={roles} />
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users yet. Invite one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
