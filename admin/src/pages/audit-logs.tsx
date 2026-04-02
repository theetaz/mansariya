import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ShieldIcon } from "lucide-react"

import { fetchAuditLogs, type AuditEntry } from "@/lib/api"
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"

// ── Action badge colors ──────────────────────────────────────────────────

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

// ── Columns ──────────────────────────────────────────────────────────────

const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
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
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Actor" />
    ),
    cell: ({ row }) => (
      <div>
        <p className="text-sm font-medium">{row.original.actor_email || "System"}</p>
        {row.original.actor_id && (
          <p className="text-xs text-muted-foreground">{row.original.actor_id.slice(0, 8)}</p>
        )}
      </div>
    ),
    meta: {
      filterConfig: {
        type: "text",
        label: "Actor",
        placeholder: "Filter by email...",
      },
    },
  },
  {
    accessorKey: "action",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
    cell: ({ row }) => actionBadge(row.original.action),
    meta: {
      filterConfig: {
        type: "select",
        label: "Action",
        options: [
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
          { value: "role.updated", label: "Role Updated" },
          { value: "role.deleted", label: "Role Deleted" },
          { value: "role.permissions_updated", label: "Permissions Updated" },
        ],
      },
    },
  },
  {
    accessorKey: "target_type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target" />
    ),
    cell: ({ row }) =>
      row.original.target_type && row.original.target_id ? (
        <div>
          <span className="text-sm font-medium">{row.original.target_type}</span>
          <span className="text-xs text-muted-foreground ml-1">
            {row.original.target_id.slice(0, 12)}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">--</span>
      ),
    meta: {
      filterConfig: {
        type: "select",
        label: "Target Type",
        options: [
          { value: "user", label: "User" },
          { value: "role", label: "Role" },
          { value: "session", label: "Session" },
        ],
      },
    },
  },
  {
    accessorKey: "ip_address",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="IP Address" />
    ),
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
      if (!meta || Object.keys(meta).length === 0) {
        return <span className="text-muted-foreground">--</span>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {Object.entries(meta).map(([key, value]) => (
            <span
              key={key}
              className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {key}={String(value)}
            </span>
          ))}
        </div>
      )
    },
    enableSorting: false,
    enableHiding: true,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────

export function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchAuditLogs({ limit: 500 }),
  })

  const entries = data?.entries ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between px-4 md:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldIcon className="size-6" />
            Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground">
            Authentication events and privileged action history.
            {!isLoading && <span className="ml-1">{entries.length} entries.</span>}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        searchPlaceholder="Search audit logs..."
        pageSize={15}
      />
    </div>
  )
}
