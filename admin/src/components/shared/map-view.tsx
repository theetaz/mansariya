import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapViewProps {
  className?: string;
  polyline?: [number, number][];
  stops?: { lat: number; lng: number; name: string; order?: number; isTerminal?: boolean }[];
  buses?: { lat: number; lng: number; id: string; routeId?: string; confidence?: string }[];
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

// Sri Lanka default center
const DEFAULT_CENTER: [number, number] = [80.7718, 7.8731];
const DEFAULT_ZOOM = 8;

export function MapView({
  className = 'h-64',
  polyline,
  stops,
  buses,
  center,
  zoom,
  interactive = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: center ?? DEFAULT_CENTER,
      zoom: zoom ?? DEFAULT_ZOOM,
      interactive,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, interactive]);

  // Draw polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !polyline || polyline.length < 2) return;

    const addPolyline = () => {
      if (map.getSource('route-line')) {
        (map.getSource('route-line') as maplibregl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: polyline },
        });
      } else {
        map.addSource('route-line', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: polyline },
          },
        });
        map.addLayer({
          id: 'route-line-layer',
          type: 'line',
          source: 'route-line',
          paint: {
            'line-color': '#e53e3e',
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });
      }

      // Fit bounds to polyline
      const bounds = new maplibregl.LngLatBounds();
      polyline.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    };

    if (map.isStyleLoaded()) {
      addPolyline();
    } else {
      map.on('load', addPolyline);
    }
  }, [polyline]);

  // Draw stop markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!stops || stops.length === 0) return;

    const addMarkers = () => {
      stops.forEach((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : stop.isTerminal ? '#f59e0b' : '#6366f1';

        const el = document.createElement('div');
        el.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 10 }).setHTML(
              `<div style="font-size:12px;"><strong>${stop.order !== undefined ? `#${stop.order + 1} ` : ''}${stop.name}</strong></div>`,
            ),
          )
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      addMarkers();
    } else {
      map.on('load', addMarkers);
    }
  }, [stops]);

  // Draw bus markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !buses || buses.length === 0) return;

    const addBusMarkers = () => {
      buses.forEach((bus) => {
        const el = document.createElement('div');
        const color = bus.confidence === 'verified' ? '#22c55e' : bus.confidence === 'good' ? '#f59e0b' : '#ef4444';
        el.style.cssText = `
          width: 16px; height: 16px; border-radius: 4px;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.lng, bus.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 10 }).setHTML(
              `<div style="font-size:12px;"><strong>Bus ${bus.id}</strong>${bus.routeId ? `<br/>Route: ${bus.routeId}` : ''}</div>`,
            ),
          )
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      addBusMarkers();
    } else {
      map.on('load', addBusMarkers);
    }
  }, [buses]);

  return <div ref={containerRef} className={className} />;
}
