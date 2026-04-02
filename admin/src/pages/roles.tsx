import { useState, useMemo, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2Icon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  ShieldIcon,
  ShieldCheckIcon,
  KeyRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAdminRoles,
  fetchAdminPermissions,
  createRole,
  updateRole,
  deleteRole,
  fetchRolePermissions,
  setRolePermissions,
  type AdminRole,
  type AdminPermission,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Permission families ordering ───────────────────────────────────────

const FAMILY_ORDER = [
  "routes",
  "stops",
  "timetables",
  "map",
  "simulations",
  "data",
  "users",
  "system",
]

function familyLabel(family: string): string {
  return family.charAt(0).toUpperCase() + family.slice(1)
}

// ── Create / Edit Role Dialog ──────────────────────────────────────────

function RoleFormDialog({
  open,
  onOpenChange,
  editingRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRole: AdminRole | null
}) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const isEdit = editingRole !== null

  // Sync form fields when editingRole changes
  useEffect(() => {
    if (editingRole) {
      setSlug(editingRole.slug)
      setName(editingRole.name)
      setDescription(editingRole.description)
    } else {
      setSlug("")
      setName("")
      setDescription("")
    }
  }, [editingRole])

  const createMutation = useMutation({
    mutationFn: () => createRole(slug, name, description),
    onSuccess: () => {
      toast.success("Role created successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
      onOpenChange(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create role"),
  })

  const updateMutation = useMutation({
    mutationFn: () => updateRole(editingRole!.id, name, description),
    onSuccess: () => {
      toast.success("Role updated successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
      onOpenChange(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update role"),
  })

  function resetForm() {
    setSlug("")
    setName("")
    setDescription("")
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = isEdit ? name.trim().length > 0 : slug.trim().length > 0 && name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the role name and description."
              : "Create a new custom role with a unique slug."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {!isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="role-slug">Slug</Label>
              <Input
                id="role-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="e.g. route-editor"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens, and underscores only.
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Route Editor"
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-desc">Description</Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this role can do"
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => (isEdit ? updateMutation.mutate() : createMutation.mutate())}
            disabled={!canSubmit || isPending}
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirmation Dialog ──────────────────────────────────────────

function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: AdminRole | null
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deleteRole(role!.id),
    onSuccess: () => {
      toast.success(`Deleted role "${role!.name}"`)
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete role"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the role &ldquo;{role?.name}&rdquo;? This
            action cannot be undone. Users with this role will lose its permissions.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Delete Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Manage Permissions Dialog ───────────────────────────────────────────

function PermissionsDialog({
  open,
  onOpenChange,
  role,
  allPermissions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: AdminRole | null
  allPermissions: AdminPermission[]
}) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  const rolePermsQuery = useQuery({
    queryKey: ["role-permissions", role?.id],
    queryFn: () => fetchRolePermissions(role!.id),
    enabled: open && role !== null,
  })

  // Initialize selected IDs from fetched role permissions
  if (rolePermsQuery.data && !initialized) {
    const ids = new Set(rolePermsQuery.data.permissions.map((p) => p.id))
    setSelectedIds(ids)
    setInitialized(true)
  }

  // Reset initialized state when dialog closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setInitialized(false)
      setSelectedIds(new Set())
    }
    onOpenChange(next)
  }

  const saveMutation = useMutation({
    mutationFn: () => setRolePermissions(role!.id, Array.from(selectedIds)),
    onSuccess: () => {
      toast.success(`Permissions updated for "${role!.name}"`)
      queryClient.invalidateQueries({ queryKey: ["role-permissions", role!.id] })
      handleOpenChange(false)
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update permissions"),
  })

  function togglePermission(permId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) {
        next.delete(permId)
      } else {
        next.add(permId)
      }
      return next
    })
  }

  function toggleFamily(family: string, perms: AdminPermission[]) {
    const familyIds = perms.map((p) => p.id)
    const allSelected = familyIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of familyIds) {
        if (allSelected) {
          next.delete(id)
        } else {
          next.add(id)
        }
      }
      return next
    })
  }

  // Group permissions by family
  const grouped = useMemo(() => {
    const map = new Map<string, AdminPermission[]>()
    for (const perm of allPermissions) {
      const existing = map.get(perm.family) ?? []
      existing.push(perm)
      map.set(perm.family, existing)
    }
    // Sort by FAMILY_ORDER, put unknown families at the end
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      const ai = FAMILY_ORDER.indexOf(a)
      const bi = FAMILY_ORDER.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    return sorted
  }, [allPermissions])

  const isLoading = rolePermsQuery.isLoading

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            Permissions for &ldquo;{role?.name}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Toggle permissions for this role. Changes are saved when you click Save.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 py-2">
            {grouped.map(([family, perms]) => {
              const familyIds = perms.map((p) => p.id)
              const allChecked = familyIds.every((id) => selectedIds.has(id))
              const someChecked = familyIds.some((id) => selectedIds.has(id)) && !allChecked

              return (
                <div key={family} className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`family-${family}`}
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={() => toggleFamily(family, perms)}
                    />
                    <Label
                      htmlFor={`family-${family}`}
                      className="text-sm font-semibold cursor-pointer"
                    >
                      {familyLabel(family)}
                    </Label>
                    <Badge variant="secondary" className="text-xs">
                      {familyIds.filter((id) => selectedIds.has(id)).length}/{familyIds.length}
                    </Badge>
                  </div>
                  <div className="ml-6 grid gap-2 sm:grid-cols-2">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-start gap-2">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={selectedIds.has(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <div className="grid gap-0.5">
                          <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer leading-none">
                            {perm.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────

export function RolesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null)
  const [permissionsTarget, setPermissionsTarget] = useState<AdminRole | null>(null)

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRoles,
  })

  const permissionsQuery = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: fetchAdminPermissions,
  })

  const roles = rolesQuery.data?.roles ?? []
  const allPermissions = permissionsQuery.data?.permissions ?? []

  function handleEdit(role: AdminRole) {
    setEditingRole(role)
    setFormOpen(true)
  }

  function handleCreate() {
    setEditingRole(null)
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditingRole(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Manage operator roles and their access levels.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleCreate}>
          <PlusIcon className="size-4" />
          Create Role
        </Button>
      </div>

      {/* Roles table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            {roles.length} role{roles.length !== 1 ? "s" : ""} configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[200px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {role.is_system ? (
                          <ShieldCheckIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ShieldIcon className="size-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {role.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.description || "--"}
                    </TableCell>
                    <TableCell>
                      {role.is_system ? (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheckIcon className="size-3" />
                          System
                        </Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPermissionsTarget(role)}
                        >
                          <KeyRoundIcon className="size-3" />
                          Permissions
                        </Button>
                        {!role.is_system && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleEdit(role)}
                            >
                              <PencilIcon className="size-3" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(role)}
                            >
                              <Trash2Icon className="size-3" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {roles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No roles found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RoleFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        editingRole={editingRole}
      />

      <DeleteRoleDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        role={deleteTarget}
      />

      <PermissionsDialog
        open={permissionsTarget !== null}
        onOpenChange={(open) => { if (!open) setPermissionsTarget(null) }}
        role={permissionsTarget}
        allPermissions={allPermissions}
      />
    </div>
  )
}
