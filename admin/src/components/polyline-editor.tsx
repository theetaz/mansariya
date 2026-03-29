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

// Find nearest polyline point to a click. When excludeNear is set, skip indices within ±minGap.
function findNearestPolylineIndex(
  polyline: [number, number][],
  lng: number,
  lat: number,
  excludeNear?: number,
  minGap = 10,
): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < polyline.length; i++) {
    if (excludeNear !== undefined && Math.abs(i - excludeNear) < minGap) continue;
    const d = (polyline[i][0] - lng) ** 2 + (polyline[i][1] - lat) ** 2;
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function PolylineEditor({ polyline, stops, mapCenter, mapZoom, onSave, onCancel, isSaving }: PolylineEditorProps) {
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

  const resetCut = useCallback(() => {
    setCutMode('off');
    setCutStartIdx(null);
    setCutEndIdx(null);
  }, []);

  // Adjust cut marker by dragging — snaps to nearest polyline point
  const handleCutMarkerDrag = useCallback((which: 'start' | 'end', lngLat: { lng: number; lat: number }) => {
    const otherIdx = which === 'start' ? cutEndIdx : cutStartIdx;
    const idx = findNearestPolylineIndex(workingPolyline, lngLat.lng, lngLat.lat, otherIdx ?? undefined);
    if (which === 'start') {
      setCutStartIdx(idx);
    } else {
      setCutEndIdx(idx);
    }
  }, [workingPolyline, cutStartIdx, cutEndIdx]);

  const handleApplyCut = useCallback(() => {
    if (cutStartIdx === null || cutEndIdx === null) return;

    const startI = Math.min(cutStartIdx, cutEndIdx);
    const endI = Math.max(cutStartIdx, cutEndIdx);
    const removeCount = endI - startI - 1;

    if (removeCount < 1) {
      toast.error('Points too close. Try dragging the markers further apart.');
      resetCut();
      return;
    }

    pushHistory();
    const newPolyline = [
      ...workingPolyline.slice(0, startI + 1),
      ...workingPolyline.slice(endI),
    ];
    setWorkingPolyline(newPolyline);
    setHasChanges(true);
    toast.success(`Removed ${removeCount} points (${workingPolyline.length} → ${newPolyline.length})`);
    resetCut();
  }, [cutStartIdx, cutEndIdx, workingPolyline, pushHistory, resetCut]);

  const handleSave = useCallback(() => {
    onSave(workingPolyline);
  }, [workingPolyline, onSave]);

  // Highlighted section for cut preview
  const cutHighlight = useMemo(() => {
    if (cutStartIdx === null || cutEndIdx === null) return null;
    const startI = Math.min(cutStartIdx, cutEndIdx);
    const endI = Math.max(cutStartIdx, cutEndIdx);
    return workingPolyline.slice(startI, endI + 1);
  }, [cutStartIdx, cutEndIdx, workingPolyline]);

  const isInCutMode = cutMode !== 'off';
  const hasCutSelection = cutStartIdx !== null && cutEndIdx !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRebuildFromStops}
          disabled={isRebuilding || !!previewPolyline || isInCutMode || hasCutSelection}
        >
          {isRebuilding ? <RiLoader4Line className="size-4 mr-1 animate-spin" /> : <RiRefreshLine className="size-4 mr-1" />}
          Rebuild from Stops
        </Button>

        <Button
          size="sm"
          variant={isInCutMode ? 'default' : 'outline'}
          onClick={() => {
            if (isInCutMode || hasCutSelection) {
              resetCut();
            } else {
              setCutMode('pick-start');
              toast.info('Click on the map to set the cut start point');
            }
          }}
          disabled={!!previewPolyline}
        >
          <RiScissorsLine className="size-4 mr-1" />
          {isInCutMode || hasCutSelection ? 'Cancel Cut' : 'Cut Section'}
        </Button>

        {hasCutSelection && (
          <>
            <Badge variant="secondary" className="text-xs">
              {Math.abs(cutEndIdx! - cutStartIdx!) - 1} points selected
            </Badge>
            <Button size="sm" variant="destructive" onClick={handleApplyCut}>
              Remove Selection
            </Button>
          </>
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
            {cutMode === 'pick-start' ? 'Click: set cut start' : 'Click: set cut end'}
          </Badge>
        )}

        {hasCutSelection && (
          <Badge variant="outline" className="text-xs">
            Drag red markers to adjust
          </Badge>
        )}

        <Badge variant="outline" className="text-xs">
          {workingPolyline.length} points
        </Badge>

        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving || !!previewPolyline || isInCutMode || hasCutSelection}>
          <RiSaveLine className="size-4 mr-1" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <RiCloseLine className="size-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Map — uses same center/zoom as the read-only map to preserve view */}
      <div className="flex-1 min-h-0">
        <Map center={mapCenter} zoom={mapZoom}>
          <MapControls showZoom showLocate showFullscreen />

          {/* Map click handler for cut mode */}
          <CutClickHandler
            enabled={isInCutMode}
            polyline={workingPolyline}
            cutMode={cutMode}
            cutStartIdx={cutStartIdx}
            onStartPicked={(idx) => {
              setCutStartIdx(idx);
              setCutMode('pick-end');
              toast.info('Now click to set the cut end point');
            }}
            onEndPicked={(idx) => {
              setCutEndIdx(idx);
              setCutMode('off');
              toast.info('Section selected — drag red markers to adjust, then "Remove Selection"');
            }}
          />

          {/* Working polyline */}
          <MapRoute
            key={`working-${workingPolyline.length}`}
            coordinates={workingPolyline}
            color={previewPolyline ? '#ef4444' : '#1D9E75'}
            width={previewPolyline ? 3 : 4}
          />

          {/* Cut highlight section (red, thicker) */}
          {cutHighlight && cutHighlight.length >= 2 && (
            <MapRoute
              key={`cut-${cutStartIdx}-${cutEndIdx}`}
              coordinates={cutHighlight}
              color="#ef4444"
              width={6}
            />
          )}

          {/* Preview polyline */}
          {previewPolyline && (
            <MapRoute coordinates={previewPolyline} color="#378ADD" width={4} />
          )}

          {/* Control points (hidden during cut mode and preview) */}
          {!previewPolyline && !isInCutMode && !hasCutSelection && controlPoints.map((cp) => (
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

          {/* Cut start marker — draggable to adjust */}
          {cutStartIdx !== null && (
            <MapMarker
              longitude={workingPolyline[cutStartIdx][0]}
              latitude={workingPolyline[cutStartIdx][1]}
              draggable={!isInCutMode}
              onDragEnd={(lngLat) => handleCutMarkerDrag('start', lngLat)}
            >
              <MarkerContent>
                <div className="size-5 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">A</span>
                </div>
              </MarkerContent>
              <MarkerTooltip>Cut start (idx {cutStartIdx}) — drag to adjust</MarkerTooltip>
            </MapMarker>
          )}
          {cutEndIdx !== null && (
            <MapMarker
              longitude={workingPolyline[cutEndIdx][0]}
              latitude={workingPolyline[cutEndIdx][1]}
              draggable
              onDragEnd={(lngLat) => handleCutMarkerDrag('end', lngLat)}
            >
              <MarkerContent>
                <div className="size-5 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">B</span>
                </div>
              </MarkerContent>
              <MarkerTooltip>Cut end (idx {cutEndIdx}) — drag to adjust</MarkerTooltip>
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
function CutClickHandler({ enabled, polyline, cutMode, cutStartIdx, onStartPicked, onEndPicked }: {
  enabled: boolean;
  polyline: [number, number][];
  cutMode: CutMode;
  cutStartIdx: number | null;
  onStartPicked: (idx: number) => void;
  onEndPicked: (idx: number) => void;
}) {
  const { map } = useMap();
  const polylineRef = useRef(polyline);
  polylineRef.current = polyline;
  const cutModeRef = useRef(cutMode);
  cutModeRef.current = cutMode;
  const cutStartRef = useRef(cutStartIdx);
  cutStartRef.current = cutStartIdx;
  const startRef = useRef(onStartPicked);
  startRef.current = onStartPicked;
  const endRef = useRef(onEndPicked);
  endRef.current = onEndPicked;

  useEffect(() => {
    if (!map) return;

    const handler = (e: { lngLat: { lat: number; lng: number } }) => {
      if (!enabled) return;
      if (cutModeRef.current === 'pick-start') {
        const idx = findNearestPolylineIndex(polylineRef.current, e.lngLat.lng, e.lngLat.lat);
        startRef.current(idx);
      } else if (cutModeRef.current === 'pick-end') {
        const idx = findNearestPolylineIndex(polylineRef.current, e.lngLat.lng, e.lngLat.lat, cutStartRef.current ?? undefined);
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
