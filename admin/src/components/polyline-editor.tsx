import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  RiRefreshLine,
  RiSaveLine,
  RiCloseLine,
  RiLoader4Line,
  RiScissorsLine,
  RiArrowGoBackLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Map,
  useMap,
  MapRoute,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapControls,
} from '@/components/ui/map';
import { getRoute } from '@/lib/geo';

interface PolylineEditorProps {
  polyline: [number, number][];
  stops: { lat: number; lng: number; name: string; stop_order: number }[];
  mapCenter: [number, number];
  mapZoom: number;
  onSave: (coordinates: [number, number][]) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

interface ControlPoint {
  id: number;
  coordIndex: number;
  lng: number;
  lat: number;
}

function generateControlPoints(polyline: [number, number][], targetCount = 25): ControlPoint[] {
  if (polyline.length < 2) return [];
  const step = Math.max(1, Math.floor(polyline.length / targetCount));
  const points: ControlPoint[] = [];
  for (let i = 0; i < polyline.length; i += step) {
    points.push({ id: i, coordIndex: i, lng: polyline[i][0], lat: polyline[i][1] });
  }
  const lastIdx = polyline.length - 1;
  if (points[points.length - 1]?.coordIndex !== lastIdx) {
    points.push({ id: lastIdx, coordIndex: lastIdx, lng: polyline[lastIdx][0], lat: polyline[lastIdx][1] });
  }
  return points;
}

export function PolylineEditor({ polyline, stops, mapCenter, mapZoom, onSave, onCancel, isSaving }: PolylineEditorProps) {
  const [workingPolyline, setWorkingPolyline] = useState<[number, number][]>(polyline);
  const [previewPolyline, setPreviewPolyline] = useState<[number, number][] | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const controlPoints = useMemo(() => generateControlPoints(workingPolyline), [workingPolyline]);

  // Cut mode: range-based
  const [cutActive, setCutActive] = useState(false);
  const [cutStart, setCutStart] = useState(0);
  const [cutEnd, setCutEnd] = useState(0);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-10), workingPolyline]);
  }, [workingPolyline]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setWorkingPolyline(last);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRebuildFromStops = useCallback(async () => {
    if (stops.length < 2) {
      toast.error('Need at least 2 stops to rebuild');
      return;
    }
    setIsRebuilding(true);
    const coords = stops.map((s) => [s.lng, s.lat] as [number, number]);
    const result = await getRoute(
      coords[0],
      coords[coords.length - 1],
      coords.length > 2 ? coords.slice(1, -1) : undefined,
    );
    setIsRebuilding(false);
    if (!result || result.code !== 'Ok' || result.routes.length === 0) {
      toast.error('Failed to rebuild route from OSRM');
      return;
    }
    const newCoords = result.routes[0].geometry.coordinates as [number, number][];
    setPreviewPolyline(newCoords);
    toast.success(`Preview: ${newCoords.length} points from ${stops.length} stops`);
  }, [stops]);

  const handleApplyPreview = useCallback(() => {
    if (previewPolyline) {
      pushHistory();
      setWorkingPolyline(previewPolyline);
      setPreviewPolyline(null);
      setHasChanges(true);
      toast.success('Polyline updated from preview');
    }
  }, [previewPolyline, pushHistory]);

  const handleDiscardPreview = useCallback(() => {
    setPreviewPolyline(null);
  }, []);

  const handleControlPointDrag = useCallback(async (pointId: number, lngLat: { lng: number; lat: number }) => {
    const cpIndex = controlPoints.findIndex((cp) => cp.id === pointId);
    if (cpIndex < 0) return;
    const prevCp = cpIndex > 0 ? controlPoints[cpIndex - 1] : null;
    const nextCp = cpIndex < controlPoints.length - 1 ? controlPoints[cpIndex + 1] : null;
    const segmentPoints: [number, number][] = [];
    if (prevCp) segmentPoints.push([prevCp.lng, prevCp.lat]);
    segmentPoints.push([lngLat.lng, lngLat.lat]);
    if (nextCp) segmentPoints.push([nextCp.lng, nextCp.lat]);
    if (segmentPoints.length < 2) return;
    const result = await getRoute(
      segmentPoints[0],
      segmentPoints[segmentPoints.length - 1],
      segmentPoints.length > 2 ? segmentPoints.slice(1, -1) : undefined,
    );
    if (!result || result.code !== 'Ok' || result.routes.length === 0) return;
    const newSegment = result.routes[0].geometry.coordinates as [number, number][];
    pushHistory();
    setWorkingPolyline((prev) => {
      const startIdx = prevCp ? prevCp.coordIndex : 0;
      const endIdx = nextCp ? nextCp.coordIndex : prev.length - 1;
      return [...prev.slice(0, startIdx), ...newSegment, ...prev.slice(endIdx + 1)];
    });
    setHasChanges(true);
  }, [controlPoints, pushHistory]);

  const handleStartCut = useCallback(() => {
    // Default selection: middle 10% of polyline
    const len = workingPolyline.length;
    const mid = Math.floor(len / 2);
    const range = Math.max(10, Math.floor(len * 0.05));
    setCutStart(mid - range);
    setCutEnd(mid + range);
    setCutActive(true);
    toast.info('Use the sliders below the map to select the section to remove');
  }, [workingPolyline]);

  const handleApplyCut = useCallback(() => {
    const startI = Math.min(cutStart, cutEnd);
    const endI = Math.max(cutStart, cutEnd);
    const removeCount = endI - startI - 1;
    if (removeCount < 1) {
      toast.error('Selection too small');
      return;
    }
    pushHistory();
    const newPoly = [...workingPolyline.slice(0, startI + 1), ...workingPolyline.slice(endI)];
    setWorkingPolyline(newPoly);
    setHasChanges(true);
    setCutActive(false);
    toast.success(`Removed ${removeCount} points (${workingPolyline.length} → ${newPoly.length})`);
  }, [cutStart, cutEnd, workingPolyline, pushHistory]);

  const handleSave = useCallback(() => {
    onSave(workingPolyline);
  }, [workingPolyline, onSave]);

  // Cut highlight polyline section
  const cutHighlight = useMemo(() => {
    if (!cutActive) return null;
    const startI = Math.min(cutStart, cutEnd);
    const endI = Math.max(cutStart, cutEnd);
    if (endI - startI < 2) return null;
    return workingPolyline.slice(startI, endI + 1);
  }, [cutActive, cutStart, cutEnd, workingPolyline]);

  // Markers at cut boundaries
  const cutStartPoint = cutActive && workingPolyline[cutStart] ? workingPolyline[cutStart] : null;
  const cutEndPoint = cutActive && workingPolyline[cutEnd] ? workingPolyline[cutEnd] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRebuildFromStops}
          disabled={isRebuilding || !!previewPolyline || cutActive}
        >
          {isRebuilding ? <RiLoader4Line className="size-4 mr-1 animate-spin" /> : <RiRefreshLine className="size-4 mr-1" />}
          Rebuild from Stops
        </Button>

        <Button
          size="sm"
          variant={cutActive ? 'default' : 'outline'}
          onClick={() => cutActive ? setCutActive(false) : handleStartCut()}
          disabled={!!previewPolyline}
        >
          <RiScissorsLine className="size-4 mr-1" />
          {cutActive ? 'Cancel Cut' : 'Cut Section'}
        </Button>

        {cutActive && (
          <Button size="sm" variant="destructive" onClick={handleApplyCut}>
            Remove {Math.abs(cutEnd - cutStart) - 1} points
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={handleUndo} disabled={history.length === 0}>
          <RiArrowGoBackLine className="size-4 mr-1" />
          Undo
        </Button>

        {previewPolyline && (
          <>
            <Badge variant="secondary" className="text-xs">Preview: {previewPolyline.length} points</Badge>
            <Button size="sm" onClick={handleApplyPreview}>Apply</Button>
            <Button size="sm" variant="outline" onClick={handleDiscardPreview}>Discard</Button>
          </>
        )}

        <div className="flex-1" />

        <Badge variant="outline" className="text-xs">{workingPolyline.length} points</Badge>

        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving || !!previewPolyline || cutActive}>
          <RiSaveLine className="size-4 mr-1" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <RiCloseLine className="size-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <Map center={mapCenter} zoom={mapZoom}>
          <MapControls showZoom showLocate showFullscreen />

          {/* Working polyline */}
          <MapRoute
            key={`working-${workingPolyline.length}`}
            coordinates={workingPolyline}
            color={previewPolyline ? '#ef4444' : cutActive ? '#666666' : '#1D9E75'}
            width={previewPolyline ? 3 : 4}
            opacity={cutActive ? 0.5 : 0.8}
          />

          {/* Cut highlight (red, thick) */}
          {cutHighlight && cutHighlight.length >= 2 && (
            <MapRoute
              key={`cut-${cutStart}-${cutEnd}`}
              coordinates={cutHighlight}
              color="#ef4444"
              width={6}
              opacity={0.9}
            />
          )}

          {/* Cut boundary markers */}
          {cutStartPoint && (
            <MapMarker longitude={cutStartPoint[0]} latitude={cutStartPoint[1]}>
              <MarkerContent>
                <div className="size-5 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">A</span>
                </div>
              </MarkerContent>
              <MarkerTooltip>Cut start — point {cutStart}</MarkerTooltip>
            </MapMarker>
          )}
          {cutEndPoint && (
            <MapMarker longitude={cutEndPoint[0]} latitude={cutEndPoint[1]}>
              <MarkerContent>
                <div className="size-5 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">B</span>
                </div>
              </MarkerContent>
              <MarkerTooltip>Cut end — point {cutEnd}</MarkerTooltip>
            </MapMarker>
          )}

          {/* Preview polyline */}
          {previewPolyline && (
            <MapRoute coordinates={previewPolyline} color="#378ADD" width={4} />
          )}

          {/* Control points (hidden during cut and preview) */}
          {!previewPolyline && !cutActive && controlPoints.map((cp) => (
            <MapMarker
              key={cp.id}
              longitude={cp.lng}
              latitude={cp.lat}
              draggable
              onDragEnd={(lngLat) => handleControlPointDrag(cp.id, lngLat)}
            >
              <MarkerContent>
                <div className="size-3.5 rounded-full bg-white border-2 border-primary shadow-md cursor-grab active:cursor-grabbing" />
              </MarkerContent>
            </MapMarker>
          ))}

          {/* Stop markers */}
          {stops.map((s, i) => (
            <MapMarker key={`stop-${i}`} longitude={s.lng} latitude={s.lat}>
              <MarkerContent>
                <div
                  className="flex items-center justify-center size-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold text-white"
                  style={{ background: i === 0 ? '#22c55e' : i === stops.length - 1 ? '#ef4444' : '#6366f1' }}
                >
                  {s.stop_order + 1}
                </div>
              </MarkerContent>
              <MarkerTooltip>#{s.stop_order + 1} {s.name}</MarkerTooltip>
            </MapMarker>
          ))}
        </Map>
      </div>

      {/* Cut range sliders — shown below the map when cut mode is active */}
      {cutActive && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Slide to select the section to remove. The red section on the map will be cut.</span>
            <span className="font-mono">{Math.abs(cutEnd - cutStart) - 1} points selected</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Cut Start (point A): {cutStart}</Label>
              <input
                type="range"
                min={0}
                max={workingPolyline.length - 1}
                value={cutStart}
                onChange={(e) => setCutStart(parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cut End (point B): {cutEnd}</Label>
              <input
                type="range"
                min={0}
                max={workingPolyline.length - 1}
                value={cutEnd}
                onChange={(e) => setCutEnd(parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
