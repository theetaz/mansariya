import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  DownloadIcon,
  UploadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react"

import { fetchAdminRoutes } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ── Export helpers ───────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Upload state ────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "success" | "error"

// ── Page ────────────────────────────────────────────────────────────────

export function DataPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [dragOver, setDragOver] = useState(false)

  const { data: routesData, isLoading } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: fetchAdminRoutes,
    staleTime: 60_000,
  })

  const routes = routesData?.routes ?? []
  const routeCount = routesData?.count ?? 0

  // ── CSV export ────────────────────────────────────────────────────────

  function exportCSV() {
    if (routes.length === 0) {
      toast.error("No routes to export")
      return
    }

    const headers = [
      "id",
      "name_en",
      "operator",
      "service_type",
      "fare_lkr",
      "stop_count",
      "is_active",
    ]
    const csvRows = [headers.join(",")]

    for (const r of routes) {
      const row = [
        r.id,
        `"${r.name_en.replace(/"/g, '""')}"`,
        `"${r.operator.replace(/"/g, '""')}"`,
        r.service_type,
        r.fare_lkr,
        r.stop_count,
        r.is_active,
      ]
      csvRows.push(row.join(","))
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" })
    downloadBlob(blob, `mansariya-routes-${Date.now()}.csv`)
    toast.success(`Exported ${routes.length} routes as CSV`)
  }

  // ── JSON export ───────────────────────────────────────────────────────

  function exportJSON() {
    if (routes.length === 0) {
      toast.error("No routes to export")
      return
    }

    const blob = new Blob([JSON.stringify(routes, null, 2)], {
      type: "application/json",
    })
    downloadBlob(blob, `mansariya-routes-${Date.now()}.json`)
    toast.success(`Exported ${routes.length} routes as JSON`)
  }

  // ── Import (placeholder) ──────────────────────────────────────────────

  function handleImport(file: File) {
    if (!file) return

    setUploadState("uploading")

    // Simulated import -- replace with actual API call
    setTimeout(() => {
      const isValid =
        file.name.endsWith(".csv") || file.name.endsWith(".json")
      if (isValid) {
        setUploadState("success")
        toast.success(`Imported "${file.name}" successfully`)
      } else {
        setUploadState("error")
        toast.error("Unsupported file format. Use CSV or JSON.")
      }
    }, 1500)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImport(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImport(file)
    e.target.value = ""
  }

  // ── Upload zone content ───────────────────────────────────────────────

  function renderUploadContent() {
    switch (uploadState) {
      case "uploading":
        return (
          <div className="flex flex-col items-center gap-2">
            <Loader2Icon className="size-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        )
      case "success":
        return (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2Icon className="size-10 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Import successful
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadState("idle")}
            >
              Import another
            </Button>
          </div>
        )
      case "error":
        return (
          <div className="flex flex-col items-center gap-2">
            <AlertCircleIcon className="size-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Import failed
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadState("idle")}
            >
              Try again
            </Button>
          </div>
        )
      default:
        return (
          <div className="flex flex-col items-center gap-2">
            <UploadIcon className="size-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop file here or{" "}
                <label className="cursor-pointer text-primary underline underline-offset-2">
                  browse
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports CSV and JSON
              </p>
            </div>
          </div>
        )
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <DownloadIcon className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Import / Export
          </h1>
          <p className="text-sm text-muted-foreground">
            Bulk data operations for route management
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-4 px-4 md:grid-cols-2 lg:px-6">
        {/* Export card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadIcon className="size-4 text-primary" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download route data in your preferred format
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="h-14 justify-start gap-3"
              onClick={exportCSV}
              disabled={isLoading || routes.length === 0}
            >
              <FileSpreadsheetIcon className="size-5 shrink-0 text-emerald-600" />
              <div className="flex flex-1 items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-medium">Export as CSV</p>
                  <p className="text-xs text-muted-foreground">
                    Spreadsheet-ready format
                  </p>
                </div>
                <Badge variant="secondary">{routeCount} routes</Badge>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-14 justify-start gap-3"
              onClick={exportJSON}
              disabled={isLoading || routes.length === 0}
            >
              <FileJsonIcon className="size-5 shrink-0 text-blue-600" />
              <div className="flex flex-1 items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-medium">Export as JSON</p>
                  <p className="text-xs text-muted-foreground">
                    Full route data with all fields
                  </p>
                </div>
                <Badge variant="secondary">{routeCount} routes</Badge>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Import card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="size-4 text-primary" />
              Import Data
            </CardTitle>
            <CardDescription>
              Upload route data from CSV or JSON files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`flex min-h-[180px] items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : uploadState === "error"
                    ? "border-destructive/40 bg-destructive/5"
                    : uploadState === "success"
                      ? "border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-muted-foreground/20 bg-muted/30"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {renderUploadContent()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
