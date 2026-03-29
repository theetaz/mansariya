import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import MapLibreGL from 'maplibre-gl';
import { useMap } from '@/components/ui/map';

interface AnimatedBusMarkerProps {
  id: string;
  lat: number;
  lng: number;
  bearing: number;
  confidence: 'low' | 'good' | 'verified';
  tooltip?: string;
}

const COLORS = {
  verified: '#22c55e',
  good: '#f59e0b',
  low: '#ef4444',
};

export function AnimatedBusMarker({ id, lat, lng, bearing, confidence, tooltip }: AnimatedBusMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<MapLibreGL.Marker | null>(null);
  const animRef = useRef<number>(0);
  const currentPos = useRef({ lat, lng, bearing });
  const targetPos = useRef({ lat, lng, bearing });
  const tooltipRef = useRef<MapLibreGL.Popup | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const tooltipContainer = useMemo(() => document.createElement('div'), []);

  // Create marker once
  useEffect(() => {
    if (!map) return;

    const el = document.createElement('div');
    el.style.width = '36px';
    el.style.height = '36px';
    el.style.cursor = 'pointer';
    elRef.current = el;

    const marker = new MapLibreGL.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .setRotation(bearing)
      .addTo(map);

    markerRef.current = marker;
    currentPos.current = { lat, lng, bearing };

    // Tooltip on hover
    const popup = new MapLibreGL.Popup({
      offset: 20,
      closeButton: false,
      closeOnClick: false,
      className: 'mapcn-tooltip',
    }).setMaxWidth('none').setDOMContent(tooltipContainer);
    tooltipRef.current = popup;

    el.addEventListener('mouseenter', () => {
      popup.setLngLat(marker.getLngLat()).addTo(map);
    });
    el.addEventListener('mouseleave', () => {
      popup.remove();
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      popup.remove();
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Animate to new position — spans the full poll interval so bus never stops
  useEffect(() => {
    targetPos.current = { lat, lng, bearing };

    const marker = markerRef.current;
    if (!marker) return;

    const startPos = { ...currentPos.current };
    const startTime = performance.now();
    // Match poll interval (3s) so animation fills the entire gap between updates
    const duration = 3000;

    // Normalize bearing difference for shortest rotation
    let bearingDiff = bearing - startPos.bearing;
    if (bearingDiff > 180) bearingDiff -= 360;
    if (bearingDiff < -180) bearingDiff += 360;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-in-out for continuous feel — no sharp start or stop
      const ease = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const curLat = startPos.lat + (lat - startPos.lat) * ease;
      const curLng = startPos.lng + (lng - startPos.lng) * ease;
      const curBearing = startPos.bearing + bearingDiff * ease;

      marker.setLngLat([curLng, curLat]);
      marker.setRotation(curBearing);
      currentPos.current = { lat: curLat, lng: curLng, bearing: curBearing };

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
  }, [lat, lng, bearing]);

  const color = COLORS[confidence];

  return (
    <>
      {/* Render bus icon into marker element */}
      {elRef.current && createPortal(
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Pulse ring */}
          <circle cx="18" cy="18" r="16" fill={color} opacity="0.15">
            <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.08;0.25" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Bus body */}
          <rect x="10" y="8" width="16" height="22" rx="4" fill={color} />
          {/* Windshield */}
          <rect x="12" y="10" width="12" height="6" rx="2" fill="white" opacity="0.9" />
          {/* Side windows */}
          <rect x="12" y="18" width="5" height="4" rx="1" fill="white" opacity="0.5" />
          <rect x="19" y="18" width="5" height="4" rx="1" fill="white" opacity="0.5" />
          {/* Headlights */}
          <circle cx="13" cy="27" r="1.5" fill="white" opacity="0.8" />
          <circle cx="23" cy="27" r="1.5" fill="white" opacity="0.8" />
          {/* Direction arrow at top */}
          <path d="M18 4 L21 9 L15 9 Z" fill={color} />
        </svg>,
        elRef.current,
      )}
      {/* Render tooltip content */}
      {createPortal(
        <div className="bg-foreground text-background rounded-md px-2.5 py-1.5 text-xs shadow-lg">
          {tooltip}
        </div>,
        tooltipContainer,
      )}
    </>
  );
}
