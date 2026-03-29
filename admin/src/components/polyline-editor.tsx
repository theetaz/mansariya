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

type CutMode = 'off' | 'pick-start' | 'pick-end';

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

function findNearestPolylineIndex(polyline: [number, number][], lng: number, lat: number): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < polyline.length; i++) {
    const d = (polyline[i][0] - lng) ** 2 + (polyline[i][1] - lat) ** 2;
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function PolylineEditor({ polyline, stops, onSave, onCancel, isSaving }: PolylineEditorProps) {
  const [workingPolyline, setWorkingPolyline] = useState<[number, number][]>(polyline);
  const [previewPolyline, setPreviewPolyline] = useState<[number, number][] | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const controlPoints = useMemo(() => generateControlPoints(workingPolyline), [workingPolyline]);

  // Cut mode state
  const [cutMode, setCutMode] = useState<CutMode>('off');
  const [cutStartIdx, setCutStartIdx] = useState<number | null>(null);
  const [cutEndIdx, setCutEndIdx] = useState<number | null>(null);

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
    toast.success(`Preview: ${newCoords.length} points generated from ${stops.length} stops`);
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
      const before = prev.slice(0, startIdx);
      const after = prev.slice(endIdx + 1);
      return [...before, ...newSegment, ...after];
    });
    setHasChanges(true);
  }, [controlPoints, pushHistory]);

  // Cut section: apply
  const handleApplyCut = useCallback(async () => {
    if (cutStartIdx === null || cutEndIdx === null) return;

    const startI = Math.min(cutStartIdx, cutEndIdx);
    const endI = Math.max(cutStartIdx, cutEndIdx);

    if (endI - startI < 2) {
      toast.error('Selection too small to cut');
      resetCut();
      return;
    }

    // Get the points at cut boundaries
    const startPoint = workingPolyline[startI];
    const endPoint = workingPolyline[endI];

    // Try OSRM re-route for the gap, or just connect directly
    let bridge: [number, number][] = [startPoint, endPoint];
    const result = await getRoute(startPoint, endPoint);
    if (result?.code === 'Ok' && result.routes.length > 0) {
      bridge = result.routes[0].geometry.coordinates as [number, number][];
    }

    pushHistory();
    const before = workingPolyline.slice(0, startI);
    const after = workingPolyline.slice(endI + 1);
    setWorkingPolyline([...before, ...bridge, ...after]);
    setHasChanges(true);
    toast.success(`Cut ${endI - startI} points, re-routed gap`);
    resetCut();
  }, [cutStartIdx, cutEndIdx, workingPolyline, pushHistory]);

  const resetCut = useCallback(() => {
    setCutMode('off');
    setCutStartIdx(null);
    setCutEndIdx(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave(workingPolyline);
  }, [workingPolyline, onSave]);

  const initialCenter = useMemo((): [number, number] => {
    if (workingPolyline.length > 0) return workingPolyline[0];
    return [79.86, 6.93];
  }, []);

  // Highlighted section for cut preview
  const cutHighlight = useMemo(() => {
    if (cutStartIdx === null || cutEndIdx === null) return null;
    const startI = Math.min(cutStartIdx, cutEndIdx);
    const endI = Math.max(cutStartIdx, cutEndIdx);
    return workingPolyline.slice(startI, endI + 1);
  }, [cutStartIdx, cutEndIdx, workingPolyline]);

  const isInCutMode = cutMode !== 'off';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRebuildFromStops}
          disabled={isRebuilding || !!previewPolyline || isInCutMode}
        >
          {isRebuilding ? <RiLoader4Line className="size-4 mr-1 animate-spin" /> : <RiRefreshLine className="size-4 mr-1" />}
          Rebuild from Stops
        </Button>

        <Button
          size="sm"
          variant={isInCutMode ? 'default' : 'outline'}
          onClick={() => {
            if (isInCutMode) {
              resetCut();
            } else {
              setCutMode('pick-start');
              toast.info('Click on the map to set the cut start point');
            }
          }}
          disabled={!!previewPolyline}
        >
          <RiScissorsLine className="size-4 mr-1" />
          {isInCutMode ? 'Cancel Cut' : 'Cut Section'}
        </Button>

        {cutEndIdx !== null && cutStartIdx !== null && (
          <Button size="sm" variant="destructive" onClick={handleApplyCut}>
            Remove Selection
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleUndo}
          disabled={history.length === 0}
        >
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

        {isInCutMode && (
          <Badge variant="default" className="text-xs">
            {cutMode === 'pick-start' ? 'Click: set cut start' : cutMode === 'pick-end' ? 'Click: set cut end' : 'Ready to cut'}
          </Badge>
        )}

        <Badge variant="outline" className="text-xs">
          {workingPolyline.length} points
        </Badge>

        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving || !!previewPolyline || isInCutMode}>
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
        <Map center={initialCenter} zoom={12}>
          <MapControls showZoom showLocate showFullscreen />
          <FitToPolyline polyline={workingPolyline} />

          {/* Map click handler for cut mode */}
          <CutClickHandler
            enabled={isInCutMode}
            polyline={workingPolyline}
            cutMode={cutMode}
            onStartPicked={(idx) => {
              setCutStartIdx(idx);
              setCutMode('pick-end');
              toast.info('Now click to set the cut end point');
            }}
            onEndPicked={(idx) => {
              setCutEndIdx(idx);
              setCutMode('off');
              toast.info('Section selected — click "Remove Selection" to cut');
            }}
          />

          {/* Working polyline */}
          <MapRoute
            coordinates={workingPolyline}
            color={previewPolyline ? '#ef4444' : '#1D9E75'}
            width={previewPolyline ? 3 : 4}
          />

          {/* Cut highlight section (red) */}
          {cutHighlight && cutHighlight.length >= 2 && (
            <MapRoute coordinates={cutHighlight} color="#ef4444" width={6} />
          )}

          {/* Preview polyline */}
          {previewPolyline && (
            <MapRoute coordinates={previewPolyline} color="#378ADD" width={4} />
          )}

          {/* Control points (hidden during cut mode and preview) */}
          {!previewPolyline && !isInCutMode && controlPoints.map((cp) => (
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

          {/* Cut start/end markers */}
          {cutStartIdx !== null && (
            <MapMarker longitude={workingPolyline[cutStartIdx][0]} latitude={workingPolyline[cutStartIdx][1]}>
              <MarkerContent>
                <div className="size-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
              </MarkerContent>
              <MarkerTooltip>Cut start</MarkerTooltip>
            </MapMarker>
          )}
          {cutEndIdx !== null && (
            <MapMarker longitude={workingPolyline[cutEndIdx][0]} latitude={workingPolyline[cutEndIdx][1]}>
              <MarkerContent>
                <div className="size-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
              </MarkerContent>
              <MarkerTooltip>Cut end</MarkerTooltip>
            </MapMarker>
          )}

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
    </div>
  );
}

// Handles map clicks for the cut tool
function CutClickHandler({ enabled, polyline, cutMode, onStartPicked, onEndPicked }: {
  enabled: boolean;
  polyline: [number, number][];
  cutMode: CutMode;
  onStartPicked: (idx: number) => void;
  onEndPicked: (idx: number) => void;
}) {
  const { map } = useMap();
  const polylineRef = useRef(polyline);
  polylineRef.current = polyline;
  const cutModeRef = useRef(cutMode);
  cutModeRef.current = cutMode;
  const startRef = useRef(onStartPicked);
  startRef.current = onStartPicked;
  const endRef = useRef(onEndPicked);
  endRef.current = onEndPicked;

  useEffect(() => {
    if (!map) return;

    const handler = (e: { lngLat: { lat: number; lng: number } }) => {
      if (!enabled) return;
      const idx = findNearestPolylineIndex(polylineRef.current, e.lngLat.lng, e.lngLat.lat);
      if (cutModeRef.current === 'pick-start') {
        startRef.current(idx);
      } else if (cutModeRef.current === 'pick-end') {
        endRef.current(idx);
      }
    };

    map.on('click', handler);
    map.getCanvas().style.cursor = enabled ? 'crosshair' : '';

    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map, enabled]);

  return null;
}

function FitToPolyline({ polyline }: { polyline: [number, number][] }) {
  const { map } = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || polyline.length < 2 || fitted.current) return;
    fitted.current = true;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of polyline) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 500 });
  }, [map, polyline]);

  return null;
}
