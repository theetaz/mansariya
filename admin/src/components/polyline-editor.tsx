import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  RiRefreshLine,
  RiSaveLine,
  RiCloseLine,
  RiLoader4Line,
  RiDeleteBinLine,
  RiArrowGoBackLine,
  RiAddLine,
  RiEyeLine,
  RiEyeOffLine,
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

type Mode = 'select' | 'add' | 'idle';

export function PolylineEditor({ polyline, stops, mapCenter, mapZoom, onSave, onCancel, isSaving }: PolylineEditorProps) {
  const [workingPolyline, setWorkingPolyline] = useState<[number, number][]>(polyline);
  const [previewPolyline, setPreviewPolyline] = useState<[number, number][] | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>('idle');
  const [showPoints, setShowPoints] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [history, setHistory] = useState<[number, number][][]>([]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-10), workingPolyline]);
  }, [workingPolyline]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setWorkingPolyline(last);
      setSelectedPoints(new Set());
      return prev.slice(0, -1);
    });
  }, []);

  // Toggle point selection
  const togglePoint = useCallback((idx: number) => {
    setSelectedPoints((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Select range — shift+click to select all between last selected and this point
  const selectRange = useCallback((idx: number) => {
    setSelectedPoints((prev) => {
      const sorted = Array.from(prev).sort((a, b) => a - b);
      if (sorted.length === 0) return new Set([idx]);
      const last = sorted[sorted.length - 1];
      const start = Math.min(last, idx);
      const end = Math.max(last, idx);
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(i);
      return next;
    });
  }, []);

  // Remove selected points
  const handleRemoveSelected = useCallback(() => {
    if (selectedPoints.size === 0) return;
    pushHistory();
    const newPoly = workingPolyline.filter((_, i) => !selectedPoints.has(i));
    setWorkingPolyline(newPoly);
    setSelectedPoints(new Set());
    setHasChanges(true);
    toast.success(`Removed ${selectedPoints.size} points (${workingPolyline.length} → ${newPoly.length})`);
  }, [selectedPoints, workingPolyline, pushHistory]);

  // Add point — click on map to insert after the nearest point
  const handleAddPoint = useCallback((lngLat: { lng: number; lat: number }) => {
    // Find the nearest segment and insert the new point there
    let bestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < workingPolyline.length; i++) {
      const d = (workingPolyline[i][0] - lngLat.lng) ** 2 + (workingPolyline[i][1] - lngLat.lat) ** 2;
      if (d < minDist) { minDist = d; bestIdx = i; }
    }

    pushHistory();
    const newPoly = [...workingPolyline];
    // Insert after the nearest point
    newPoly.splice(bestIdx + 1, 0, [lngLat.lng, lngLat.lat]);
    setWorkingPolyline(newPoly);
    setHasChanges(true);
    setMode('idle');
    toast.success(`Added point at index ${bestIdx + 1}`);
  }, [workingPolyline, pushHistory]);

  // Rebuild from stops via OSRM
  const handleRebuildFromStops = useCallback(async () => {
    if (stops.length < 2) { toast.error('Need at least 2 stops'); return; }
    setIsRebuilding(true);
    const coords = stops.map((s) => [s.lng, s.lat] as [number, number]);
    const result = await getRoute(coords[0], coords[coords.length - 1], coords.length > 2 ? coords.slice(1, -1) : undefined);
    setIsRebuilding(false);
    if (!result || result.code !== 'Ok' || !result.routes.length) { toast.error('OSRM rebuild failed'); return; }
    const newCoords = result.routes[0].geometry.coordinates as [number, number][];
    setPreviewPolyline(newCoords);
    toast.success(`Preview: ${newCoords.length} points from ${stops.length} stops`);
  }, [stops]);

  const handleApplyPreview = useCallback(() => {
    if (!previewPolyline) return;
    pushHistory();
    setWorkingPolyline(previewPolyline);
    setPreviewPolyline(null);
    setSelectedPoints(new Set());
    setHasChanges(true);
    toast.success('Polyline updated');
  }, [previewPolyline, pushHistory]);

  // Select all / deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedPoints.size === workingPolyline.length) {
      setSelectedPoints(new Set());
    } else {
      setSelectedPoints(new Set(workingPolyline.map((_, i) => i)));
    }
  }, [selectedPoints, workingPolyline]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30 flex-wrap">
        <Button size="sm" variant="outline" onClick={handleRebuildFromStops}
          disabled={isRebuilding || !!previewPolyline}>
          {isRebuilding ? <RiLoader4Line className="size-4 mr-1 animate-spin" /> : <RiRefreshLine className="size-4 mr-1" />}
          Rebuild from Stops
        </Button>

        {previewPolyline && (
          <>
            <Badge variant="secondary" className="text-xs">Preview: {previewPolyline.length} pts</Badge>
            <Button size="sm" onClick={handleApplyPreview}>Apply</Button>
            <Button size="sm" variant="outline" onClick={() => setPreviewPolyline(null)}>Discard</Button>
          </>
        )}

        {!previewPolyline && (
          <>
            <Button size="sm" variant={showPoints ? 'default' : 'outline'}
              onClick={() => setShowPoints(!showPoints)}>
              {showPoints ? <RiEyeLine className="size-4 mr-1" /> : <RiEyeOffLine className="size-4 mr-1" />}
              Points
            </Button>

            <Button size="sm" variant={mode === 'add' ? 'default' : 'outline'}
              onClick={() => setMode(mode === 'add' ? 'idle' : 'add')}>
              <RiAddLine className="size-4 mr-1" />
              {mode === 'add' ? 'Cancel Add' : 'Add Point'}
            </Button>

            {selectedPoints.size > 0 && (
              <>
                <Button size="sm" variant="destructive" onClick={handleRemoveSelected}>
                  <RiDeleteBinLine className="size-4 mr-1" />
                  Remove {selectedPoints.size} points
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedPoints(new Set())}>
                  Deselect All
                </Button>
              </>
            )}
          </>
        )}

        <Button size="sm" variant="outline" onClick={handleUndo} disabled={history.length === 0}>
          <RiArrowGoBackLine className="size-4 mr-1" />
          Undo
        </Button>

        <div className="flex-1" />

        {mode === 'add' && <Badge variant="default" className="text-xs">Click map to add point</Badge>}
        {showPoints && selectedPoints.size === 0 && mode !== 'add' && (
          <Badge variant="outline" className="text-xs">Click points to select, Shift+click for range</Badge>
        )}

        <Badge variant="outline" className="text-xs">{workingPolyline.length} pts</Badge>

        <Button size="sm" onClick={() => onSave(workingPolyline)}
          disabled={!hasChanges || isSaving || !!previewPolyline}>
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

          {/* Add point click handler */}
          {mode === 'add' && <MapClickHandler onMapClick={handleAddPoint} />}

          {/* Working polyline */}
          <MapRoute
            key={`working-${workingPolyline.length}`}
            coordinates={workingPolyline}
            color={previewPolyline ? '#ef4444' : '#1D9E75'}
            width={previewPolyline ? 3 : 4}
            opacity={previewPolyline ? 0.4 : 0.8}
          />

          {/* Preview polyline */}
          {previewPolyline && (
            <MapRoute coordinates={previewPolyline} color="#378ADD" width={4} />
          )}

          {/* All coordinate points — shown when showPoints is true */}
          {showPoints && !previewPolyline && workingPolyline.map(([lng, lat], i) => {
            const isSelected = selectedPoints.has(i);
            return (
              <MapMarker key={`pt-${i}-${lng}-${lat}`} longitude={lng} latitude={lat}
                onClick={() => {
                  if (mode === 'add') return;
                  // Check if shift is held (we store it via a global listener)
                  if ((window as any).__shiftHeld) selectRange(i);
                  else togglePoint(i);
                }}>
                <MarkerContent>
                  <div className={`rounded-full border shadow-sm cursor-pointer transition-all ${
                    isSelected
                      ? 'size-3 bg-red-500 border-red-300 ring-2 ring-red-400/50'
                      : 'size-1.5 bg-white/80 border-white/50 hover:size-2.5 hover:bg-blue-400 hover:border-blue-300'
                  }`} />
                </MarkerContent>
                {isSelected && <MarkerTooltip>Point {i} — selected</MarkerTooltip>}
              </MapMarker>
            );
          })}

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

          {/* Shift key tracker */}
          <ShiftKeyTracker />
        </Map>
      </div>
    </div>
  );
}

// Tracks shift key state globally for shift+click range selection
function ShiftKeyTracker() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') (window as any).__shiftHeld = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') (window as any).__shiftHeld = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); (window as any).__shiftHeld = false; };
  }, []);
  return null;
}

// Map click handler for adding points
function MapClickHandler({ onMapClick }: { onMapClick: (lngLat: { lng: number; lat: number }) => void }) {
  const { map } = useMap();
  const cbRef = useRef(onMapClick);
  cbRef.current = onMapClick;

  useEffect(() => {
    if (!map) return;
    const handler = (e: { lngLat: { lat: number; lng: number } }) => cbRef.current(e.lngLat);
    map.on('click', handler);
    map.getCanvas().style.cursor = 'crosshair';
    return () => { map.off('click', handler); map.getCanvas().style.cursor = ''; };
  }, [map]);

  return null;
}
