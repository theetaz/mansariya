import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table"
import {
  Loader2Icon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  ShieldIcon,
  ShieldCheckIcon,
  KeyRoundIcon,
  EllipsisVerticalIcon,
  CheckIcon,
  XIcon,
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
  checkRoleSlug,
  type AdminRole,
  type AdminPermission,
  type AdminRolesParams,
} from "@/lib/api"
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"

// ── Permission families ──────────────────────────────────────────────────

const FAMILY_ORDER = ["routes", "stops", "timetables", "map", "simulations", "data", "users", "system"]
function familyLabel(f: string) { return f.charAt(0).toUpperCase() + f.slice(1) }

// ── Slug generation ──────────────────────────────────────────────────────

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

// ── Create / Edit Role Dialog ────────────────────────────────────────────

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
  const isEdit = editingRole !== null

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManual, setSlugManual] = useState(false)
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [slugSuggestion, setSlugSuggestion] = useState("")
  const [description, setDescription] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name)
      setSlug(editingRole.slug)
      setDescription(editingRole.description)
      setSlugManual(true)
      setSlugStatus("idle")
    } else {
      setName(""); setSlug(""); setDescription("")
      setSlugManual(false); setSlugStatus("idle"); setSlugSuggestion("")
    }
  }, [editingRole, open])

  const checkSlug = useCallback((s: string) => {
    if (!s || isEdit) return
    setSlugStatus("checking")
    checkRoleSlug(s).then((res) => {
      if (res.available) {
        setSlugStatus("available")
      } else {
        setSlugStatus("taken")
        setSlugSuggestion(res.suggestion)
      }
    }).catch(() => setSlugStatus("idle"))
  }, [isEdit])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual && !isEdit) {
      const generated = nameToSlug(value)
      setSlug(generated)
      clearTimeout(debounceRef.current)
      if (generated) {
        debounceRef.current = setTimeout(() => checkSlug(generated), 400)
      } else {
        setSlugStatus("idle")
      }
    }
  }

  function handleSlugChange(value: string) {
    const clean = value.toLowerCase().replace(/[^a-z0-9-_]/g, "")
    setSlug(clean)
    setSlugManual(true)
    clearTimeout(debounceRef.current)
    if (clean) {
      debounceRef.current = setTimeout(() => checkSlug(clean), 400)
    } else {
      setSlugStatus("idle")
    }
  }

  function useSuggestion() {
    setSlug(slugSuggestion)
    setSlugManual(true)
    setSlugStatus("available")
    setSlugSuggestion("")
  }

  const createMut = useMutation({
    mutationFn: () => createRole(slug, name, description),
    onSuccess: () => {
      toast.success("Role created")
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: () => updateRole(editingRole!.id, name, description),
    onSuccess: () => {
      toast.success("Role updated")
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isPending = createMut.isPending || updateMut.isPending
  const canSubmit = name.trim().length > 0 && (isEdit || (slug.trim().length > 0 && slugStatus !== "taken"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the role details." : "Create a new custom role."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Route Editor" disabled={isPending} autoFocus />
          </div>
          {!isEdit && (
            <div className="grid gap-2">
              <Label>Slug</Label>
              <div className="relative">
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="auto-generated-from-name"
                  disabled={isPending}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {slugStatus === "checking" && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
                  {slugStatus === "available" && <CheckIcon className="size-4 text-emerald-500" />}
                  {slugStatus === "taken" && <XIcon className="size-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === "taken" && slugSuggestion && (
                <p className="text-xs text-muted-foreground">
                  Slug taken. Try{" "}
                  <button type="button" className="font-medium text-primary underline" onClick={useSuggestion}>
                    {slugSuggestion}
                  </button>
                </p>
              )}
              <p className="text-xs text-muted-foreground">Lowercase, hyphens, underscores only.</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What can this role do?"
              disabled={isPending}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={() => isEdit ? updateMut.mutate() : createMut.mutate()} disabled={!canSubmit || isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Dialog ────────────────────────────────────────────────────────

function DeleteRoleDialog({ open, onOpenChange, role }: { open: boolean; onOpenChange: (v: boolean) => void; role: AdminRole | null }) {
  const queryClient = useQueryClient()
  const mut = useMutation({
    mutationFn: () => deleteRole(role!.id),
    onSuccess: () => { toast.success(`Deleted "${role!.name}"`); queryClient.invalidateQueries({ queryKey: ["admin-roles"] }); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>Delete &ldquo;{role?.name}&rdquo;? Users with this role will lose its permissions.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Permissions Dialog ───────────────────────────────────────────────────

function PermissionsDialog({ open, onOpenChange, role, allPermissions }: {
  open: boolean; onOpenChange: (v: boolean) => void; role: AdminRole | null; allPermissions: AdminPermission[]
}) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  const rolePermsQuery = useQuery({
    queryKey: ["role-permissions", role?.id],
    queryFn: () => fetchRolePermissions(role!.id),
    enabled: open && role !== null,
  })

  useEffect(() => {
    if (rolePermsQuery.data && !initialized) {
      setSelectedIds(new Set((rolePermsQuery.data.permissions ?? []).map((p: AdminPermission) => p.id)))
      setInitialized(true)
    }
  }, [rolePermsQuery.data, initialized])

  function handleClose(v: boolean) { if (!v) { setInitialized(false); setSelectedIds(new Set()) }; onOpenChange(v) }

  const saveMut = useMutation({
    mutationFn: () => setRolePermissions(role!.id, Array.from(selectedIds)),
    onSuccess: () => { toast.success("Permissions updated"); queryClient.invalidateQueries({ queryKey: ["role-permissions", role!.id] }); handleClose(false) },
    onError: (err: Error) => toast.error(err.message),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, AdminPermission[]>()
    for (const p of allPermissions) { map.set(p.family, [...(map.get(p.family) ?? []), p]) }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = FAMILY_ORDER.indexOf(a); const bi = FAMILY_ORDER.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [allPermissions])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRoundIcon className="size-4" />Permissions for &ldquo;{role?.name}&rdquo;</DialogTitle>
          <DialogDescription>Toggle permissions. Save when done.</DialogDescription>
        </DialogHeader>
        {rolePermsQuery.isLoading ? (
          <div className="flex justify-center py-8"><Loader2Icon className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-6 py-2">
            {grouped.map(([family, perms]) => {
              const ids = perms.map((p) => p.id)
              const allChecked = ids.every((id) => selectedIds.has(id))
              const someChecked = ids.some((id) => selectedIds.has(id)) && !allChecked
              return (
                <div key={family} className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id={`f-${family}`} checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={() => setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((id) => allChecked ? n.delete(id) : n.add(id)); return n })} />
                    <Label htmlFor={`f-${family}`} className="text-sm font-semibold cursor-pointer">{familyLabel(family)}</Label>
                    <Badge variant="secondary" className="text-xs">{ids.filter((id) => selectedIds.has(id)).length}/{ids.length}</Badge>
                  </div>
                  <div className="ml-6 grid gap-2 sm:grid-cols-2">
                    {perms.map((p) => (
                      <div key={p.id} className="flex items-start gap-2">
                        <Checkbox id={`p-${p.id}`} checked={selectedIds.has(p.id)}
                          onCheckedChange={() => setSelectedIds((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })} />
                        <div className="grid gap-0.5">
                          <Label htmlFor={`p-${p.id}`} className="text-sm cursor-pointer leading-none">{p.name}</Label>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
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
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || rolePermsQuery.isLoading}>
            {saveMut.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Row actions dropdown ─────────────────────────────────────────────────

function RoleActions({ role, onPermissions, onEdit, onDelete }: {
  role: AdminRole
  onPermissions: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8 p-0">
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onPermissions}>
          <KeyRoundIcon className="mr-2 size-4" />Permissions
        </DropdownMenuItem>
        {!role.is_system && (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon className="mr-2 size-4" />Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2Icon className="mr-2 size-4" />Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export function RolesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null)
  const [permsTarget, setPermsTarget] = useState<AdminRole | null>(null)

  // Server-side table state
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const queryParams = useMemo<AdminRolesParams>(() => {
    const p: AdminRolesParams = { limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize }
    if (globalFilter) p.search = globalFilter
    if (sorting.length > 0) { p.sort_by = sorting[0].id; p.sort_dir = sorting[0].desc ? "desc" : "asc" }
    return p
  }, [pagination, sorting, globalFilter])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-roles", queryParams],
    queryFn: () => fetchAdminRoles(queryParams),
    placeholderData: keepPreviousData,
  })

  const permsQuery = useQuery({ queryKey: ["admin-permissions"], queryFn: fetchAdminPermissions })
  const roles = data?.roles ?? []
  const total = data?.total ?? 0
  const allPermissions = permsQuery.data?.permissions ?? []

  function handleCreate() { setEditingRole(null); setFormOpen(true) }
  function handleEdit(r: AdminRole) { setEditingRole(r); setFormOpen(true) }

  const columns = useMemo<ColumnDef<AdminRole>[]>(() => [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.is_system ? <ShieldCheckIcon className="size-4 text-muted-foreground" /> : <ShieldIcon className="size-4 text-muted-foreground" />}
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "slug",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
      cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.slug}</code>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.description || "--"}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "is_system",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => row.original.is_system
        ? <Badge variant="secondary" className="gap-1"><ShieldCheckIcon className="size-3" />System</Badge>
        : <Badge variant="outline">Custom</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <RoleActions
          role={row.original}
          onPermissions={() => setPermsTarget(row.original)}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => setDeleteTarget(row.original)}
        />
      ),
    },
  ], [])

  return (
    <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">{total} role{total !== 1 ? "s" : ""} configured.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleCreate}><PlusIcon className="size-4" />Create Role</Button>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        isLoading={isLoading}
        searchPlaceholder="Search roles..."
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

      <RoleFormDialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingRole(null) }} editingRole={editingRole} />
      <DeleteRoleDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} role={deleteTarget} />
      <PermissionsDialog open={permsTarget !== null} onOpenChange={(v) => { if (!v) setPermsTarget(null) }} role={permsTarget} allPermissions={allPermissions} />
    </div>
  )
}
