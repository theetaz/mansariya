import { useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  MapIcon,
  ListIcon,
  ClockIcon,
  PencilIcon,
  BusFrontIcon,
  SplineIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchAdminRouteDetail,
  ADMIN_API_KEY,
  type AdminRouteDetail,
  type AdminEnrichedStop,
} from "@/lib/api"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Map,
  MapRoute,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapControls,
} from "@/components/ui/map"
import { PolylineEditor } from "@/components/polyline-editor"

// ── Helpers ─────────────────────────────────────────────────────────────

function getPolylineMidpoint(
  polyline: [number, number][]
): [number, number] {
  if (polyline.length === 0) return [79.8612, 6.9271]
  const mid = Math.floor(polyline.length / 2)
  return polyline[mid]
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min"
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Loading skeleton ────────────────────────────────────────────────────

function RouteDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-96 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ── Stop marker color ───────────────────────────────────────────────────

function getStopMarkerColor(index: number, total: number): string {
  if (index === 0) return "#1D9E75"
  if (index === total - 1) return "#E24B4A"
  return "hsl(var(--primary))"
}

// ── Info row ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  )
}

// ── Map tab ─────────────────────────────────────────────────────────────

function RouteMapTab({
  detail,
  onEditPolyline,
}: {
  detail: AdminRouteDetail
  onEditPolyline: () => void
}) {
  const polyline = detail.polyline ?? []
  const stops = detail.stops ?? []
  const center = getPolylineMidpoint(polyline)

  return (
    <div className="relative overflow-hidden rounded-xl border" style={{ height: 500 }}>
      <Map center={center} zoom={12} className="h-full w-full">
        {polyline.length >= 2 && (
          <MapRoute
            coordinates={polyline}
            color="#1D9E75"
            width={4}
            opacity={0.9}
            interactive={false}
          />
        )}

        {stops.map((stop, idx) => (
          <MapMarker
            key={stop.stop_id}
            longitude={stop.lng}
            latitude={stop.lat}
          >
            <MarkerContent>
              <div
                className="flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: getStopMarkerColor(idx, stops.length),
                }}
              >
                {stop.stop_order}
              </div>
            </MarkerContent>
            <MarkerTooltip>
              <span className="text-xs font-medium">
                {stop.name_en || `Stop ${stop.stop_order}`}
              </span>
            </MarkerTooltip>
          </MapMarker>
        ))}

        <MapControls position="bottom-right" showZoom showFullscreen />
      </Map>

      {/* Edit polyline button */}
      <div className="absolute left-3 top-3 z-10">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg backdrop-blur-sm"
          onClick={onEditPolyline}
        >
          <SplineIcon className="mr-1.5 size-3.5" />
          Edit Polyline
        </Button>
      </div>
    </div>
  )
}

// ── Polyline editor wrapper ─────────────────────────────────────────────

function RoutePolylineEditorTab({
  detail,
  routeId,
  onDone,
}: {
  detail: AdminRouteDetail
  routeId: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const mapViewRef = useRef<{
    center: [number, number]
    zoom: number
  } | null>(null)

  const polylineMutation = useMutation({
    mutationFn: async (coords: [number, number][]) => {
      const res = await fetch(`/api/v1/admin/routes/${routeId}/polyline`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": ADMIN_API_KEY,
        },
        body: JSON.stringify({ coordinates: coords, confidence: 0.5 }),
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-route-detail", routeId],
      })
      toast.success("Polyline saved")
      onDone()
    },
    onError: () => toast.error("Failed to save polyline"),
  })

  const polyline = detail.polyline ?? []
  const stops = (detail.stops ?? []).map((s) => ({
    lat: s.lat,
    lng: s.lng,
    name: s.name_en,
    stop_order: s.stop_order,
  }))

  const center = getPolylineMidpoint(polyline)

  return (
    <div className="overflow-hidden rounded-xl border" style={{ height: 600 }}>
      <PolylineEditor
        polyline={polyline}
        stops={stops}
        mapCenter={center}
        mapZoom={13}
        onSave={(coords, view) => {
          if (view) mapViewRef.current = view
          polylineMutation.mutate(coords)
        }}
        onCancel={onDone}
        isSaving={polylineMutation.isPending}
      />
    </div>
  )
}

// ── Stops tab ───────────────────────────────────────────────────────────

function RouteStopsTab({ stops }: { stops: AdminEnrichedStop[] }) {
  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-muted-foreground">
        <ListIcon className="mb-2 size-8 opacity-30" />
        <p className="text-sm">No stops assigned to this route</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">#</TableHead>
            <TableHead>Name (EN)</TableHead>
            <TableHead className="hidden md:table-cell">Name (SI)</TableHead>
            <TableHead className="hidden lg:table-cell">Lat / Lng</TableHead>
            <TableHead className="text-right">Distance</TableHead>
            <TableHead className="hidden sm:table-cell text-right">
              Duration
            </TableHead>
            <TableHead className="w-24 text-center">Terminal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stops.map((stop) => (
            <TableRow key={stop.stop_id}>
              <TableCell className="text-center tabular-nums font-medium">
                {stop.stop_order}
              </TableCell>
              <TableCell className="font-medium">
                {stop.name_en || "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {stop.name_si || "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {stop.distance_from_start_km.toFixed(1)} km
              </TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums">
                {formatDuration(stop.typical_duration_min)}
              </TableCell>
              <TableCell className="text-center">
                {stop.is_terminal ? (
                  <Badge variant="default" className="text-xs">
                    Terminal
                  </Badge>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Timetable tab ───────────────────────────────────────────────────────

function RouteTimetableTab({ timetable }: { timetable: unknown[] }) {
  if (!timetable || timetable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-muted-foreground">
        <ClockIcon className="mb-2 size-8 opacity-30" />
        <p className="text-sm">No timetable entries</p>
      </div>
    )
  }

  const entries = timetable as Array<{
    departure_time: string
    days: string[]
    service_type: string
    notes?: string
  }>

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Departure Time</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Service Type</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-mono tabular-nums font-medium">
                {entry.departure_time}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {entry.days?.map((day) => (
                    <Badge key={day} variant="secondary" className="text-xs">
                      {day}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{entry.service_type || "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.notes || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>()
  const [isEditingPolyline, setIsEditingPolyline] = useState(false)

  const { data, isLoading } = useQuery<AdminRouteDetail>({
    queryKey: ["admin-route-detail", routeId],
    queryFn: () => fetchAdminRouteDetail(routeId!),
    enabled: !!routeId,
  })

  if (isLoading || !data) {
    return <RouteDetailSkeleton />
  }

  const { route, stops, timetable } = data

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 md:gap-6 md:py-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <BusFrontIcon className="size-4 text-primary" />
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {route.id}
              </Badge>
              {route.is_active ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {route.name_en || "Unnamed Route"}
            </h2>
          </div>

          <Link to={`/routes/${routeId}/edit`}>
            <Button variant="outline">
              <PencilIcon className="mr-1.5 size-3.5" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <Separator className="mx-4 lg:mx-6" />

      {/* ── Info card ──────────────────────────────────────────────── */}
      <div className="px-4 lg:px-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Route Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Operator" value={route.operator} />
              <InfoRow label="Service Type" value={route.service_type} />
              <InfoRow
                label="Fare"
                value={
                  route.fare_lkr ? (
                    <span className="tabular-nums">
                      Rs. {route.fare_lkr.toLocaleString()}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Frequency"
                value={
                  route.frequency_minutes ? (
                    <span className="tabular-nums">
                      {route.frequency_minutes} min
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="Operating Hours" value={route.operating_hours} />
              <InfoRow
                label="Stop Count"
                value={<span className="tabular-nums">{route.stop_count}</span>}
              />
              <InfoRow
                label="Has Polyline"
                value={route.has_polyline ? "Yes" : "No"}
              />
              <InfoRow
                label="Pattern Count"
                value={
                  <span className="tabular-nums">{route.pattern_count}</span>
                }
              />
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InfoRow label="Name (English)" value={route.name_en} />
              <InfoRow label="Name (Sinhala)" value={route.name_si} />
              <InfoRow label="Name (Tamil)" value={route.name_ta} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="px-4 lg:px-6">
        <Tabs defaultValue="map" className="w-full">
          <TabsList>
            <TabsTrigger value="map" className="gap-1.5">
              <MapIcon className="size-3.5" />
              Map
            </TabsTrigger>
            <TabsTrigger value="stops" className="gap-1.5">
              <ListIcon className="size-3.5" />
              Stops
              {stops.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 text-[10px]"
                >
                  {stops.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timetable" className="gap-1.5">
              <ClockIcon className="size-3.5" />
              Timetable
              {timetable.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 text-[10px]"
                >
                  {timetable.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-4">
            {isEditingPolyline ? (
              <RoutePolylineEditorTab
                detail={data}
                routeId={routeId!}
                onDone={() => setIsEditingPolyline(false)}
              />
            ) : (
              <RouteMapTab
                detail={data}
                onEditPolyline={() => setIsEditingPolyline(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="stops" className="mt-4">
            <RouteStopsTab stops={stops} />
          </TabsContent>

          <TabsContent value="timetable" className="mt-4">
            <RouteTimetableTab timetable={timetable} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
