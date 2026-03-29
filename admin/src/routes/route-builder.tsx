import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import {
  RiRouteLine,
  RiArrowRightLine,
  RiTimeLine,
  RiPinDistanceLine,
  RiRoadMapLine,
  RiSwapLine,
} from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LocationAutocomplete } from '@/components/shared/location-autocomplete';
import { MapView } from '@/components/shared/map-view';
import { getRoute, type NominatimResult, type OSRMRoute } from '@/lib/geo';

export const Route = createFileRoute('/route-builder')({
  component: RouteBuilderPage,
});

function RouteBuilderPage() {
  const [origin, setOrigin] = useState<NominatimResult | null>(null);
  const [destination, setDestination] = useState<NominatimResult | null>(null);
  const [routeResult, setRouteResult] = useState<OSRMRoute | null>(null);
  const [waypoints, setWaypoints] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateRoute = useCallback(async () => {
    if (!origin || !destination) return;

    setIsLoading(true);
    setError('');
    setRouteResult(null);

    const start: [number, number] = [parseFloat(origin.lon), parseFloat(origin.lat)];
    const end: [number, number] = [parseFloat(destination.lon), parseFloat(destination.lat)];
    const wp = waypoints
      .filter((w) => w != null)
      .map((w) => [parseFloat(w.lon), parseFloat(w.lat)] as [number, number]);

    const result = await getRoute(start, end, wp.length > 0 ? wp : undefined);
    setIsLoading(false);

    if (!result || result.code !== 'Ok' || result.routes.length === 0) {
      setError('No route found between these locations');
      return;
    }

    setRouteResult(result.routes[0]);
  }, [origin, destination, waypoints]);

  const swapLocations = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
    setRouteResult(null);
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  };

  const mapStops = [];
  if (origin) {
    mapStops.push({
      lat: parseFloat(origin.lat),
      lng: parseFloat(origin.lon),
      name: origin.display_name.split(',')[0],
      isTerminal: true,
    });
  }
  for (const wp of waypoints) {
    if (!wp) continue;
    mapStops.push({
      lat: parseFloat(wp.lat),
      lng: parseFloat(wp.lon),
      name: wp.display_name.split(',')[0],
    });
  }
  if (destination) {
    mapStops.push({
      lat: parseFloat(destination.lat),
      lng: parseFloat(destination.lon),
      name: destination.display_name.split(',')[0],
      isTerminal: true,
    });
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Route Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plan routes between locations using Nominatim geocoding and OSRM routing
        </p>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 @3xl/main:grid-cols-[400px_1fr]">
        {/* Left Panel — Controls */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RiRouteLine className="size-4" />
                Route Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  START POINT
                </Label>
                <LocationAutocomplete
                  placeholder="Search starting location..."
                  value={origin}
                  onSelect={setOrigin}
                  onClear={() => { setOrigin(null); setRouteResult(null); }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={swapLocations}
                  disabled={!origin && !destination}
                >
                  <RiSwapLine className="size-4" />
                </Button>
                <Separator className="flex-1" />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  DESTINATION
                </Label>
                <LocationAutocomplete
                  placeholder="Search destination..."
                  value={destination}
                  onSelect={setDestination}
                  onClear={() => { setDestination(null); setRouteResult(null); }}
                />
              </div>

              {/* Waypoints */}
              {waypoints.map((wp, i) => (
                <div key={`wp-${i}`} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      WAYPOINT {i + 1}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive"
                      onClick={() => {
                        setWaypoints((prev) => prev.filter((_, j) => j !== i));
                        setRouteResult(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  <LocationAutocomplete
                    placeholder="Search waypoint..."
                    value={wp ?? null}
                    onSelect={(r) => {
                      setWaypoints((prev) => prev.map((w, j) => (j === i ? r : w)));
                      setRouteResult(null);
                    }}
                  />
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setWaypoints((prev) => [...prev, undefined as unknown as NominatimResult])}
              >
                + Add Waypoint
              </Button>

              <Button
                className="w-full"
                onClick={calculateRoute}
                disabled={!origin || !destination || isLoading}
              >
                {isLoading ? 'Calculating...' : 'Get Route'}
              </Button>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Route Details */}
          {routeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RiRoadMapLine className="size-4" />
                  Route Details
                </CardTitle>
                <CardAction>
                  <Badge variant="secondary" className="text-xs">
                    {routeResult.geometry.coordinates.length} points
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <RiPinDistanceLine className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatDistance(routeResult.distance)}
                      </p>
                      <p className="text-xs text-muted-foreground">Distance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiTimeLine className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatDuration(routeResult.duration)}
                      </p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Coordinates */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    COORDINATES
                  </p>
                  <div className="space-y-1">
                    {origin && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="size-2 rounded-full bg-green-500" />
                        <span className="font-mono">
                          {parseFloat(origin.lat).toFixed(6)}, {parseFloat(origin.lon).toFixed(6)}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {origin.display_name.split(',')[0]}
                        </span>
                      </div>
                    )}
                    {destination && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="size-2 rounded-full bg-red-500" />
                        <span className="font-mono">
                          {parseFloat(destination.lat).toFixed(6)}, {parseFloat(destination.lon).toFixed(6)}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {destination.display_name.split(',')[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Turn-by-turn legs */}
                {routeResult.legs.map((leg, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      LEG {i + 1} — {formatDistance(leg.distance)}, {formatDuration(leg.duration)}
                    </p>
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {leg.steps
                        .filter((s) => s.name && s.distance > 50)
                        .map((step, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <RiArrowRightLine className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{step.name}</span>
                            <span className="text-muted-foreground ml-auto shrink-0">
                              {formatDistance(step.distance)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                {/* Raw polyline export */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    POLYLINE DATA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {routeResult.geometry.coordinates.length} coordinate pairs
                    ({(JSON.stringify(routeResult.geometry.coordinates).length / 1024).toFixed(1)} KB)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(routeResult.geometry.coordinates, null, 2),
                      );
                    }}
                  >
                    Copy Polyline JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel — Map */}
        <Card className="min-h-[500px]">
          <CardContent className="p-0 h-full">
            <MapView
              className="h-full min-h-[500px] rounded-lg overflow-hidden"
              polyline={routeResult?.geometry.coordinates as [number, number][] | undefined}
              stops={mapStops.length > 0 ? mapStops : undefined}
              center={[79.8612, 7.0]}
              zoom={8}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
