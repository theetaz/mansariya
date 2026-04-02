"use client";

/**
 * Map component adapted from mapcn (https://github.com/AnmolSaini16/mapcn)
 * MIT License - Modified for Mansariya project
 */

import MapLibreGL, { type PopupOptions, type MarkerOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  XIcon,
  MinusIcon,
  PlusIcon,
  LocateIcon,
  MaximizeIcon,
  LoaderIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ── Default Styles ──
// Dark: CARTO Dark Matter (free for non-commercial / dev)
// Light: CARTO Positron
const defaultStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
  },
};

type Theme = "light" | "dark";

function getDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedTheme(themeProp?: Theme): Theme {
  const [detectedTheme, setDetectedTheme] = useState<Theme>(
    () => getDocumentTheme() ?? getSystemTheme(),
  );

  useEffect(() => {
    if (themeProp) return;
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) setDetectedTheme(docTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => { if (!getDocumentTheme()) setDetectedTheme(e.matches ? "dark" : "light"); };
    mq.addEventListener("change", handler);
    return () => { observer.disconnect(); mq.removeEventListener("change", handler); };
  }, [themeProp]);

  return themeProp ?? detectedTheme;
}

// ── Context ──
type MapContextValue = { map: MapLibreGL.Map | null; isLoaded: boolean };
const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used within a Map component");
  return ctx;
}

// ── Types ──
type MapViewport = { center: [number, number]; zoom: number; bearing: number; pitch: number };
type MapStyleOption = string | MapLibreGL.StyleSpecification;
type MapRef = MapLibreGL.Map;

type MapProps = {
  children?: ReactNode;
  className?: string;
  theme?: Theme;
  styles?: { light?: MapStyleOption; dark?: MapStyleOption };
  projection?: MapLibreGL.ProjectionSpecification;
  viewport?: Partial<MapViewport>;
  onViewportChange?: (viewport: MapViewport) => void;
  loading?: boolean;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

function DefaultLoader() {
  return (
    <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-xs">
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

// ── Map Component ──
const Map = forwardRef<MapRef, MapProps>(function Map(
  { children, className, theme: themeProp, styles, projection, viewport, onViewportChange, loading = false, ...props },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleRef = useRef<MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const resolvedTheme = useResolvedTheme(themeProp);
  const isControlled = viewport !== undefined && onViewportChange !== undefined;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const mapStyles = useMemo(() => ({
    dark: styles?.dark ?? defaultStyles.dark,
    light: styles?.light ?? defaultStyles.light,
  }), [styles]);

  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) { clearTimeout(styleTimeoutRef.current); styleTimeoutRef.current = null; }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;
    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: initialStyle,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      ...props,
      ...viewport,
    });
    const onStyleData = () => { clearStyleTimeout(); styleTimeoutRef.current = setTimeout(() => { setIsStyleLoaded(true); if (projection) map.setProjection(projection); }, 100); };
    const onLoad = () => setIsLoaded(true);
    const onMove = () => { if (!internalUpdateRef.current) onViewportChangeRef.current?.(getViewport(map)); };
    map.on("load", onLoad);
    map.on("styledata", onStyleData);
    map.on("move", onMove);
    setMapInstance(map);
    return () => { clearStyleTimeout(); map.off("load", onLoad); map.off("styledata", onStyleData); map.off("move", onMove); map.remove(); setIsLoaded(false); setIsStyleLoaded(false); setMapInstance(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport || mapInstance.isMoving()) return;
    const current = getViewport(mapInstance);
    const next = { center: viewport.center ?? current.center, zoom: viewport.zoom ?? current.zoom, bearing: viewport.bearing ?? current.bearing, pitch: viewport.pitch ?? current.pitch };
    if (next.center[0] === current.center[0] && next.center[1] === current.center[1] && next.zoom === current.zoom && next.bearing === current.bearing && next.pitch === current.pitch) return;
    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;
    const newStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    if (currentStyleRef.current === newStyle) return;
    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    setIsStyleLoaded(false);
    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  const contextValue = useMemo(() => ({ map: mapInstance, isLoaded: isLoaded && isStyleLoaded }), [mapInstance, isLoaded, isStyleLoaded]);

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className={cn("relative h-full w-full", className)}>
        {(!isLoaded || loading) && <DefaultLoader />}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});

// ── Marker ──
type MarkerContextValue = { marker: MapLibreGL.Marker; map: MapLibreGL.Map | null };
const MarkerContext = createContext<MarkerContextValue | null>(null);
function useMarkerContext() { const ctx = useContext(MarkerContext); if (!ctx) throw new Error("Marker components must be used within MapMarker"); return ctx; }

type MapMarkerProps = {
  longitude: number; latitude: number; children: ReactNode;
  onClick?: (e: MouseEvent) => void; onMouseEnter?: (e: MouseEvent) => void; onMouseLeave?: (e: MouseEvent) => void;
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

function MapMarker({ longitude, latitude, children, onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd, draggable = false, ...opts }: MapMarkerProps) {
  const { map } = useMap();
  const cbRef = useRef({ onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd });
  cbRef.current = { onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd };

  const marker = useMemo(() => {
    const m = new MapLibreGL.Marker({ ...opts, element: document.createElement("div"), draggable }).setLngLat([longitude, latitude]);
    m.getElement()?.addEventListener("click", (e) => cbRef.current.onClick?.(e));
    m.getElement()?.addEventListener("mouseenter", (e) => cbRef.current.onMouseEnter?.(e));
    m.getElement()?.addEventListener("mouseleave", (e) => cbRef.current.onMouseLeave?.(e));
    m.on("dragstart", () => { const ll = m.getLngLat(); cbRef.current.onDragStart?.({ lng: ll.lng, lat: ll.lat }); });
    m.on("drag", () => { const ll = m.getLngLat(); cbRef.current.onDrag?.({ lng: ll.lng, lat: ll.lat }); });
    m.on("dragend", () => { const ll = m.getLngLat(); cbRef.current.onDragEnd?.({ lng: ll.lng, lat: ll.lat }); });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!map) return; marker.addTo(map); return () => { marker.remove(); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [map]);

  if (marker.getLngLat().lng !== longitude || marker.getLngLat().lat !== latitude) marker.setLngLat([longitude, latitude]);
  if (marker.isDraggable() !== draggable) marker.setDraggable(draggable);

  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>;
}

// ── Marker Content ──
function MarkerContent({ children, className }: { children?: ReactNode; className?: string }) {
  const { marker } = useMarkerContext();
  return createPortal(<div className={cn("relative cursor-pointer", className)}>{children || <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />}</div>, marker.getElement());
}

// ── Marker Popup ──
function MarkerPopup({ children, className, closeButton = false, ...opts }: { children: ReactNode; className?: string; closeButton?: boolean } & Omit<PopupOptions, "className" | "closeButton">) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const popup = useMemo(() => new MapLibreGL.Popup({ offset: 16, ...opts, closeButton: false }).setMaxWidth("none").setDOMContent(container), /* eslint-disable-next-line react-hooks/exhaustive-deps */ []);
  useEffect(() => { if (!map) return; popup.setDOMContent(container); marker.setPopup(popup); return () => { marker.setPopup(null); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [map]);
  return createPortal(
    <div className={cn("bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 relative rounded-md border p-3 shadow-md", className)}>
      {closeButton && <button type="button" onClick={() => popup.remove()} className="absolute top-1 right-1 z-10 rounded-sm opacity-70 hover:opacity-100" aria-label="Close"><XIcon className="h-4 w-4" /></button>}
      {children}
    </div>, container,
  );
}

// ── Marker Tooltip ──
function MarkerTooltip({ children, className, ...opts }: { children: ReactNode; className?: string } & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const tooltip = useMemo(() => {
    const p = new MapLibreGL.Popup({ offset: 12, ...opts, closeOnClick: true, closeButton: false, className: "mapcn-tooltip" }).setMaxWidth("none");
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!map) return;
    tooltip.setDOMContent(container);
    const enter = () => { tooltip.setLngLat(marker.getLngLat()).addTo(map); };
    const leave = () => tooltip.remove();
    marker.getElement()?.addEventListener("mouseenter", enter);
    marker.getElement()?.addEventListener("mouseleave", leave);
    return () => { marker.getElement()?.removeEventListener("mouseenter", enter); marker.getElement()?.removeEventListener("mouseleave", leave); tooltip.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return createPortal(<div className={cn("bg-foreground text-background rounded-md px-2.5 py-1.5 text-xs shadow-lg", className)}>{children}</div>, container);
}

// ── Marker Label ──
function MarkerLabel({ children, className, position = "top" }: { children: ReactNode; className?: string; position?: "top" | "bottom" }) {
  const pos = { top: "bottom-full mb-1", bottom: "top-full mt-1" };
  return <div className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-foreground text-[10px] font-medium", pos[position], className)}>{children}</div>;
}

// ── Map Controls ──
const posClasses = { "top-left": "top-2 left-2", "top-right": "top-2 right-2", "bottom-left": "bottom-2 left-2", "bottom-right": "bottom-10 right-2" };

function ControlGroup({ children }: { children: ReactNode }) {
  return <div className="border-border bg-background [&>button:not(:last-child)]:border-border flex flex-col overflow-hidden rounded-md border shadow-sm [&>button:not(:last-child)]:border-b">{children}</div>;
}

function ControlButton({ onClick, label, children, disabled = false }: { onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return <button onClick={onClick} aria-label={label} type="button" className={cn("hover:bg-accent dark:hover:bg-accent/40 flex size-8 items-center justify-center transition-colors", disabled && "pointer-events-none opacity-50")} disabled={disabled}>{children}</button>;
}

function MapControls({ position = "bottom-right", showZoom = true, showCompass = false, showLocate = false, showFullscreen = false, className, onLocate }: {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; showZoom?: boolean; showCompass?: boolean; showLocate?: boolean; showFullscreen?: boolean; className?: string; onLocate?: (coords: { longitude: number; latitude: number }) => void;
}) {
  const { map } = useMap();
  const [locating, setLocating] = useState(false);
  const zoomIn = useCallback(() => map?.zoomTo(map.getZoom() + 1, { duration: 300 }), [map]);
  const zoomOut = useCallback(() => map?.zoomTo(map.getZoom() - 1, { duration: 300 }), [map]);
  const resetBearing = useCallback(() => map?.resetNorthPitch({ duration: 300 }), [map]);
  const locate = useCallback(() => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition((pos) => {
      const coords = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
      map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 14, duration: 1500 });
      onLocate?.(coords);
      setLocating(false);
    }, () => setLocating(false));
  }, [map, onLocate]);
  const fullscreen = useCallback(() => {
    const c = map?.getContainer();
    if (!c) return;
    document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen();
  }, [map]);

  return (
    <div className={cn("absolute z-10 flex flex-col gap-1.5", posClasses[position], className)}>
      {showZoom && <ControlGroup><ControlButton onClick={zoomIn} label="Zoom in"><PlusIcon className="size-4" /></ControlButton><ControlButton onClick={zoomOut} label="Zoom out"><MinusIcon className="size-4" /></ControlButton></ControlGroup>}
      {showCompass && <ControlGroup><ControlButton onClick={resetBearing} label="Reset north">N</ControlButton></ControlGroup>}
      {showLocate && <ControlGroup><ControlButton onClick={locate} label="My location" disabled={locating}>{locating ? <LoaderIcon className="size-4 animate-spin" /> : <LocateIcon className="size-4" />}</ControlButton></ControlGroup>}
      {showFullscreen && <ControlGroup><ControlButton onClick={fullscreen} label="Fullscreen"><MaximizeIcon className="size-4" /></ControlButton></ControlGroup>}
    </div>
  );
}

// ── Map Popup (standalone) ──
function MapPopup({ longitude, latitude, onClose, children, className, closeButton = false, ...opts }: {
  longitude: number; latitude: number; onClose?: () => void; children: ReactNode; className?: string; closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const container = useMemo(() => document.createElement("div"), []);
  const popup = useMemo(() => new MapLibreGL.Popup({ offset: 16, ...opts, closeButton: false }).setMaxWidth("none").setLngLat([longitude, latitude]), /* eslint-disable-next-line react-hooks/exhaustive-deps */ []);
  useEffect(() => {
    if (!map) return;
    popup.on("close", () => onCloseRef.current?.());
    popup.setDOMContent(container);
    popup.addTo(map);
    return () => { if (popup.isOpen()) popup.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  if (popup.isOpen() && (popup.getLngLat().lng !== longitude || popup.getLngLat().lat !== latitude)) popup.setLngLat([longitude, latitude]);
  return createPortal(
    <div className={cn("bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 relative rounded-md border p-3 shadow-md", className)}>
      {closeButton && <button type="button" onClick={() => popup.remove()} className="absolute top-1 right-1 z-10 rounded-sm opacity-70 hover:opacity-100" aria-label="Close"><XIcon className="h-4 w-4" /></button>}
      {children}
    </div>, container,
  );
}

// ── Map Route ──
function MapRoute({ id: propId, coordinates, color = "#e53e3e", width = 4, opacity = 0.8, dashArray, onClick, onMouseEnter, onMouseLeave, interactive = true }: {
  id?: string; coordinates: [number, number][]; color?: string; width?: number; opacity?: number; dashArray?: [number, number];
  onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; interactive?: boolean;
}) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `route-source-${id}`;
  const layerId = `route-layer-${id}`;

  useEffect(() => {
    if (!isLoaded || !map) return;
    map.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
    map.addLayer({ id: layerId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": width, "line-opacity": opacity, ...(dashArray && { "line-dasharray": dashArray }) } });
    return () => { try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map]);

  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
    source?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  }, [isLoaded, map, coordinates, sourceId]);

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, "line-color", color);
    map.setPaintProperty(layerId, "line-width", width);
    map.setPaintProperty(layerId, "line-opacity", opacity);
  }, [isLoaded, map, layerId, color, width, opacity]);

  useEffect(() => {
    if (!isLoaded || !map || !interactive) return;
    const click = () => onClick?.();
    const enter = () => { map.getCanvas().style.cursor = "pointer"; onMouseEnter?.(); };
    const leave = () => { map.getCanvas().style.cursor = ""; onMouseLeave?.(); };
    map.on("click", layerId, click);
    map.on("mouseenter", layerId, enter);
    map.on("mouseleave", layerId, leave);
    return () => { map.off("click", layerId, click); map.off("mouseenter", layerId, enter); map.off("mouseleave", layerId, leave); };
  }, [isLoaded, map, layerId, onClick, onMouseEnter, onMouseLeave, interactive]);

  return null;
}

export {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MarkerLabel,
  MapPopup,
  MapControls,
  MapRoute,
};

export type { MapRef, MapViewport };
