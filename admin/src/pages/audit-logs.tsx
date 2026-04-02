import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ClockIcon,
  FilterIcon,
  Loader2Icon,
  ShieldIcon,
} from "lucide-react"

import {
  fetchAuditLogs,
  type AuditEntry,
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

const PAGE_SIZE = 25

const ACTION_FILTERS = [
  { value: "all", label: "All Actions" },
  { value: "auth.login", label: "Login" },
  { value: "auth.login_failed", label: "Login Failed" },
  { value: "auth.logout", label: "Logout" },
  { value: "auth.password_reset", label: "Password Reset" },
  { value: "user.invited", label: "User Invited" },
  { value: "user.status_changed", label: "User Status Changed" },
  { value: "role.assigned", label: "Role Assigned" },
  { value: "role.removed", label: "Role Removed" },
  { value: "role.created", label: "Role Created" },
  { value: "role.deleted", label: "Role Deleted" },
] as const

function actionBadge(action: string) {
  if (action === "auth.login") {
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700">{action}</Badge>
  }
  if (action === "auth.login_failed") {
    return <Badge variant="destructive" className="gap-1">{action}</Badge>
  }
  if (action === "auth.logout") {
    return <Badge variant="secondary" className="gap-1">{action}</Badge>
  }
  if (action === "auth.password_reset") {
    return <Badge className="gap-1 bg-amber-600 hover:bg-amber-700">{action}</Badge>
  }
  if (action.startsWith("user.")) {
    return <Badge className="gap-1 bg-violet-600 hover:bg-violet-700">{action}</Badge>
  }
  if (action.startsWith("role.")) {
    return <Badge className="gap-1 bg-blue-600 hover:bg-blue-700">{action}</Badge>
  }
  return <Badge variant="outline" className="gap-1">{action}</Badge>
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function MetadataCells({ metadata }: { metadata: Record<string, string> }) {
  const entries = Object.entries(metadata)
  if (entries.length === 0) {
    return <span className="text-muted-foreground">--</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {key}={value}
        </span>
      ))}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ClockIcon className="size-3" />
          {formatTime(entry.created_at)}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="text-sm font-medium">{entry.actor_email}</p>
          <p className="text-xs text-muted-foreground">{entry.actor_id.slice(0, 8)}...</p>
        </div>
      </TableCell>
      <TableCell>{actionBadge(entry.action)}</TableCell>
      <TableCell className="text-sm">
        {entry.target_type && entry.target_id ? (
          <span>
            <span className="font-medium">{entry.target_type}</span>
            <span className="text-muted-foreground"> / {entry.target_id.slice(0, 12)}{entry.target_id.length > 12 ? "..." : ""}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">--</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground font-mono">
        {entry.ip_address || "--"}
      </TableCell>
      <TableCell>
        <MetadataCells metadata={entry.metadata ?? {}} />
      </TableCell>
    </TableRow>
  )
}

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("all")
  const [limit] = useState(PAGE_SIZE)
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, limit, offset],
    queryFn: () =>
      fetchAuditLogs({
        action: actionFilter === "all" ? undefined : actionFilter,
        limit,
        offset,
      }),
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const displayed = offset + entries.length

  function handleFilterChange(value: string) {
    setActionFilter(value)
    setOffset(0)
  }

  function handleLoadMore() {
    setOffset((prev) => prev + PAGE_SIZE)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldIcon className="size-6" />
            Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground">
            Authentication events and privileged action history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={actionFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            {total} event{total !== 1 ? "s" : ""} recorded.
            {actionFilter !== "all" && (
              <> Filtered by <span className="font-medium">{actionFilter}</span>.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldIcon className="mb-2 size-8" />
              <p>No audit entries found.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>

              {total > displayed && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                  >
                    Load more ({total - displayed} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
