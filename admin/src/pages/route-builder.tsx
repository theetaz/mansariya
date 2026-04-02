import { useState, useCallback } from "react"
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
import { Separator } from "@/components/ui/separator"
import { LocationAutocomplete } from "@/components/shared/location-autocomplete"
import {
  Map,
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

// ── Page ────────────────────────────────────────────────────────────────

export function RouteBuilderPage() {
  const [origin, setOrigin] = useState<NominatimResult | null>(null)
  const [destination, setDestination] = useState<NominatimResult | null>(null)
  const [waypoints, setWaypoints] = useState<(NominatimResult | null)[]>([])
  const [route, setRoute] = useState<OSRMRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Swap origin and destination
  const handleSwap = useCallback(() => {
    const prevOrigin = origin
    const prevDest = destination
    setOrigin(prevDest)
    setDestination(prevOrigin)
    setRoute(null)
    setError(null)
  }, [origin, destination])

  // Add a waypoint slot
  const addWaypoint = () => {
    setWaypoints((prev) => [...prev, null])
  }

  // Remove a waypoint slot
  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index))
    setRoute(null)
  }

  // Update a specific waypoint
  const updateWaypoint = (index: number, result: NominatimResult) => {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? result : wp)))
  }

  // Calculate route
  const handleGetRoute = useCallback(async () => {
    if (!origin || !destination) {
      setError("Please select both start point and destination.")
      return
    }

    setError(null)
    setLoading(true)

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
      .map(
        (wp): [number, number] => [parseFloat(wp.lon), parseFloat(wp.lat)]
      )

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

  // Copy polyline JSON to clipboard
  const handleCopyPolyline = useCallback(async () => {
    if (!route) return
    const json = JSON.stringify(route.geometry.coordinates)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [route])

  return (
    <div className="@container/main flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <RouteIcon className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Route Builder</h1>
        </div>
        <Badge variant="outline" className="ml-2">
          OSRM
        </Badge>
      </div>

      {/* Main content */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden @3xl/main:grid-cols-[400px_1fr]">
        {/* Left panel — controls */}
        <div className="flex flex-col gap-4 overflow-y-auto border-r p-4">
          {/* Route Points */}
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MapPinIcon className="size-4" />
                Route Points
              </CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addWaypoint}
                  className="h-7 gap-1 text-xs"
                >
                  <PlusIcon className="size-3" />
                  Waypoint
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Start Point */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Start Point
                </Label>
                <LocationAutocomplete
                  placeholder="Search start location..."
                  value={origin}
                  onSelect={(result) => {
                    setOrigin(result)
                    setRoute(null)
                  }}
                  onClear={() => {
                    setOrigin(null)
                    setRoute(null)
                  }}
                />
              </div>

              {/* Swap button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={handleSwap}
                >
                  <ArrowUpDownIcon className="size-4" />
                </Button>
              </div>

              {/* Waypoints */}
              {waypoints.map((wp, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Waypoint {index + 1}
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Destination
                </Label>
                <LocationAutocomplete
                  placeholder="Search destination..."
                  value={destination}
                  onSelect={(result) => {
                    setDestination(result)
                    setRoute(null)
                  }}
                  onClear={() => {
                    setDestination(null)
                    setRoute(null)
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Get Route button */}
              <Button
                className="w-full gap-2"
                onClick={handleGetRoute}
                disabled={loading || !origin || !destination}
              >
                {loading ? (
                  "Calculating..."
                ) : (
                  <>
                    <RouteIcon className="size-4" />
                    Get Route
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Route Details */}
          {route && (
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="size-4" />
                  Route Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Distance & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Distance
                      </div>
                      <div className="text-sm font-semibold">
                        {formatDistance(route.distance)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <ClockIcon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Duration
                      </div>
                      <div className="text-sm font-semibold">
                        {formatDuration(route.duration)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coordinates */}
                {origin && destination && (
                  <div className="space-y-2">
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
                      <span className="text-muted-foreground">
                        Destination:
                      </span>
                      <span className="font-mono text-[11px]">
                        {parseFloat(destination.lat).toFixed(5)},{" "}
                        {parseFloat(destination.lon).toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Turn-by-turn legs */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Legs
                  </div>
                  {route.legs.map((leg, legIdx) => (
                    <div key={legIdx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span>
                          Leg {legIdx + 1}
                          {leg.summary && (
                            <span className="ml-1 text-muted-foreground font-normal">
                              ({leg.summary})
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistance(leg.distance)}
                        </span>
                      </div>
                      <div className="space-y-0.5 pl-3 border-l-2 border-muted">
                        {leg.steps.map((step, stepIdx) => (
                          <div
                            key={stepIdx}
                            className="flex items-center justify-between py-0.5 text-xs"
                          >
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <ArrowRightIcon className="size-3 shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {step.name || step.maneuver.type}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0 ml-2">
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
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Polyline Data
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-[10px]"
                      onClick={handleCopyPolyline}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="size-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3" />
                          Copy JSON
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="max-h-24 overflow-y-auto rounded-md bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground leading-relaxed break-all">
                    {route.geometry.coordinates.length} coordinates
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel — map */}
        <div className="relative h-full min-h-[400px]">
          <Map
            center={[79.8612, 7.0]}
            zoom={8}
          >
            {/* Route polyline */}
            {route && route.geometry.coordinates.length > 1 && (
              <MapRoute
                coordinates={route.geometry.coordinates}
                color="#e53e3e"
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
                    <div className="size-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-lg" />
                  </MarkerContent>
                  <MarkerTooltip>
                    Waypoint {index + 1}:{" "}
                    {wp.display_name.split(",")[0].trim()}
                  </MarkerTooltip>
                </MapMarker>
              ) : null
            )}

            <MapControls
              position="bottom-right"
              showZoom
              showLocate
            />
          </Map>
        </div>
      </div>
    </div>
  )
}
