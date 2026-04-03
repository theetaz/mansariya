import { useState, useCallback, useEffect, useRef } from "react"
import {
  RouteIcon,
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  MapIcon,
  ArrowUpDownIcon,
  PlusIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  Trash2Icon,
  ChevronDownIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { LocationAutocomplete } from "@/components/shared/location-autocomplete"
import {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapRoute,
  MapControls,
} from "@/components/ui/map"
import { getRoute, type NominatimResult, type OSRMRoute } from "@/lib/geo"

// ── Utilities ──────────────────────────────────────────────────────────

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

// ── Auto-focus map helper ──────────────────────────────────────────────

function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const { map } = useMap()
  const lastRef = useRef("")

  useEffect(() => {
    if (!map) return
    const key = `${lat.toFixed(6)}-${lng.toFixed(6)}`
    if (key === lastRef.current) return
    lastRef.current = key
    map.flyTo({ center: [lng, lat], zoom: zoom ?? 14, duration: 1200 })
  }, [map, lat, lng, zoom])

  return null
}

function FitBounds({
  coordinates,
}: {
  coordinates: [number, number][]
}) {
  const { map } = useMap()
  const lastRef = useRef(0)

  useEffect(() => {
    if (!map || coordinates.length < 2) return
    const len = coordinates.length
    if (len === lastRef.current) return
    lastRef.current = len

    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity
    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 1200 }
    )
  }, [map, coordinates])

  return null
}

// ── Page ────────────────────────────────────────────────────────────────

export function RouteBuilderPage() {
  const [origin, setOrigin] = useState<NominatimResult | null>(null)
  const [destination, setDestination] = useState<NominatimResult | null>(null)
  const [waypoints, setWaypoints] = useState<(NominatimResult | null)[]>([])
  const [route, setRoute] = useState<OSRMRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pointsCollapsed, setPointsCollapsed] = useState(false)

  // Track which location was last selected for auto-focus
  const [focusTarget, setFocusTarget] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const handleSwap = useCallback(() => {
    const prevOrigin = origin
    const prevDest = destination
    setOrigin(prevDest)
    setDestination(prevOrigin)
    setRoute(null)
    setError(null)
  }, [origin, destination])

  const addWaypoint = () => {
    setWaypoints((prev) => [...prev, null])
  }

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
    setRoute(null)
  }

  const updateWaypoint = (index: number, result: NominatimResult) => {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? result : wp)))
    setFocusTarget({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    })
  }

  const clearAll = () => {
    setOrigin(null)
    setDestination(null)
    setWaypoints([])
    setRoute(null)
    setError(null)
    setFocusTarget(null)
  }

  const handleGetRoute = useCallback(async () => {
    if (!origin || !destination) {
      setError("Please select both start point and destination.")
      return
    }

    setError(null)
    setLoading(true)
    setFocusTarget(null) // Clear single-point focus; route will fit bounds

    const startCoords: [number, number] = [
      parseFloat(origin.lon),
      parseFloat(origin.lat),
    ]
    const endCoords: [number, number] = [
      parseFloat(destination.lon),
      parseFloat(destination.lat),
    ]

    const wpCoords = waypoints
      .filter((wp): wp is NominatimResult => wp !== null)
      .map((wp): [number, number] => [parseFloat(wp.lon), parseFloat(wp.lat)])

    const response = await getRoute(
      startCoords,
      endCoords,
      wpCoords.length > 0 ? wpCoords : undefined
    )

    setLoading(false)

    if (!response || response.code !== "Ok" || response.routes.length === 0) {
      setError("Could not calculate route. Please try different locations.")
      return
    }

    setRoute(response.routes[0])
  }, [origin, destination, waypoints])

  const handleCopyPolyline = useCallback(async () => {
    if (!route) return
    await navigator.clipboard.writeText(
      JSON.stringify(route.geometry.coordinates)
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [route])

  const hasAnySelection = origin || destination || waypoints.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2.5 lg:px-6">
        <RouteIcon className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">Route Builder</h1>
        <Badge variant="outline" className="text-[10px]">
          Nominatim + OSRM
        </Badge>
      </div>

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden @3xl/main:grid-cols-[380px_1fr]">
        {/* Left panel */}
        <div className="flex min-h-0 flex-col border-r">
          {/* Route Points — collapsible */}
          <div className="shrink-0 border-b">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/40 transition-colors"
              onClick={() => setPointsCollapsed(!pointsCollapsed)}
            >
              <span className="flex items-center gap-2">
                <MapPinIcon className="size-3.5" />
                Route Points
                {origin && destination && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {2 + waypoints.filter(Boolean).length} pts
                  </Badge>
                )}
              </span>
              <ChevronDownIcon
                className={`size-4 text-muted-foreground transition-transform ${pointsCollapsed ? "-rotate-90" : ""}`}
              />
            </button>

            {!pointsCollapsed && (
              <div className="space-y-3 px-4 pb-4">
                {/* Start Point */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Start Point
                  </Label>
                  <LocationAutocomplete
                    placeholder="Search start location..."
                    value={origin}
                    onSelect={(result) => {
                      setOrigin(result)
                      setRoute(null)
                      setFocusTarget({
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                      })
                    }}
                    onClear={() => {
                      setOrigin(null)
                      setRoute(null)
                    }}
                  />
                </div>

                {/* Swap */}
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={handleSwap}
                    disabled={!origin && !destination}
                  >
                    <ArrowUpDownIcon className="size-3.5" />
                  </Button>
                  <Separator className="flex-1" />
                </div>

                {/* Waypoints */}
                {waypoints.map((wp, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Waypoint {index + 1}
                      </Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5"
                        onClick={() => removeWaypoint(index)}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                    <LocationAutocomplete
                      placeholder={`Search waypoint ${index + 1}...`}
                      value={wp}
                      onSelect={(result) => {
                        updateWaypoint(index, result)
                        setRoute(null)
                      }}
                      onClear={() => {
                        setWaypoints((prev) =>
                          prev.map((w, i) => (i === index ? null : w))
                        )
                        setRoute(null)
                      }}
                    />
                  </div>
                ))}

                {/* Destination */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Destination
                  </Label>
                  <LocationAutocomplete
                    placeholder="Search destination..."
                    value={destination}
                    onSelect={(result) => {
                      setDestination(result)
                      setRoute(null)
                      setFocusTarget({
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                      })
                    }}
                    onClear={() => {
                      setDestination(null)
                      setRoute(null)
                    }}
                  />
                </div>

                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1.5"
                    size="sm"
                    onClick={handleGetRoute}
                    disabled={loading || !origin || !destination}
                  >
                    <RouteIcon className="size-3.5" />
                    {loading ? "Calculating..." : "Get Route"}
                  </Button>
                  {hasAnySelection && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAll}
                      className="gap-1.5"
                    >
                      <Trash2Icon className="size-3.5" />
                      Clear
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-xs text-muted-foreground"
                  onClick={addWaypoint}
                >
                  <PlusIcon className="size-3" />
                  Add Waypoint
                </Button>
              </div>
            )}
          </div>

          {/* Route Details — scrollable */}
          {route && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                {/* Distance & Duration */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <MapPinIcon className="size-3.5 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Distance
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatDistance(route.distance)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <ClockIcon className="size-3.5 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Duration
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {formatDuration(route.duration)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coordinates */}
                {origin && destination && (
                  <div className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-block size-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">Origin:</span>
                      <span className="font-mono text-[11px]">
                        {parseFloat(origin.lat).toFixed(5)},{" "}
                        {parseFloat(origin.lon).toFixed(5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-block size-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">Dest:</span>
                      <span className="font-mono text-[11px]">
                        {parseFloat(destination.lat).toFixed(5)},{" "}
                        {parseFloat(destination.lon).toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Legs */}
                <div className="space-y-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Turn-by-turn
                  </div>
                  {route.legs.map((leg, legIdx) => (
                    <div key={legIdx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span>
                          Leg {legIdx + 1}
                          {leg.summary && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({leg.summary})
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatDistance(leg.distance)}
                        </span>
                      </div>
                      <div className="space-y-0.5 border-l-2 border-muted pl-3">
                        {leg.steps
                          .filter((s) => s.distance > 20)
                          .map((step, stepIdx) => (
                            <div
                              key={stepIdx}
                              className="flex items-center justify-between py-0.5 text-xs"
                            >
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <ArrowRightIcon className="size-2.5 shrink-0" />
                                <span className="max-w-[180px] truncate">
                                  {step.name || step.maneuver.type}
                                </span>
                              </div>
                              <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground/70">
                                {formatDistance(step.distance)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Polyline data */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Polyline · {route.geometry.coordinates.length} pts
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-[10px]"
                      onClick={handleCopyPolyline}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="size-3" /> Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3" /> Copy JSON
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right panel — map */}
        <div className="relative min-h-0 flex-1">
          <Map center={[79.8612, 7.0]} zoom={8}>
            {/* Auto-focus on single location select */}
            {focusTarget && !route && (
              <FlyTo lat={focusTarget.lat} lng={focusTarget.lng} />
            )}

            {/* Auto-fit to route bounds */}
            {route && route.geometry.coordinates.length > 1 && (
              <FitBounds coordinates={route.geometry.coordinates} />
            )}

            {/* Route polyline */}
            {route && route.geometry.coordinates.length > 1 && (
              <MapRoute
                coordinates={route.geometry.coordinates}
                color="#1D9E75"
                width={4}
                opacity={0.85}
              />
            )}

            {/* Origin marker */}
            {origin && (
              <MapMarker
                longitude={parseFloat(origin.lon)}
                latitude={parseFloat(origin.lat)}
              >
                <MarkerContent>
                  <div className="size-4 rounded-full border-2 border-white bg-green-500 shadow-lg" />
                </MarkerContent>
                <MarkerTooltip>
                  {origin.display_name.split(",")[0].trim()}
                </MarkerTooltip>
              </MapMarker>
            )}

            {/* Destination marker */}
            {destination && (
              <MapMarker
                longitude={parseFloat(destination.lon)}
                latitude={parseFloat(destination.lat)}
              >
                <MarkerContent>
                  <div className="size-4 rounded-full border-2 border-white bg-red-500 shadow-lg" />
                </MarkerContent>
                <MarkerTooltip>
                  {destination.display_name.split(",")[0].trim()}
                </MarkerTooltip>
              </MapMarker>
            )}

            {/* Waypoint markers */}
            {waypoints.map((wp, index) =>
              wp ? (
                <MapMarker
                  key={index}
                  longitude={parseFloat(wp.lon)}
                  latitude={parseFloat(wp.lat)}
                >
                  <MarkerContent>
                    <div className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[9px] font-bold text-white shadow-lg">
                      {index + 1}
                    </div>
                  </MarkerContent>
                  <MarkerTooltip>
                    WP{index + 1}: {wp.display_name.split(",")[0].trim()}
                  </MarkerTooltip>
                </MapMarker>
              ) : null
            )}

            <MapControls position="bottom-right" showZoom showLocate />
          </Map>
        </div>
      </div>
    </div>
  )
}
