import { useEffect, useRef, useMemo, useCallback } from 'react';
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
  selected?: boolean;
  visible?: boolean;
  onClick?: () => void;
}

const COLORS = {
  verified: '#22c55e',
  good: '#f59e0b',
  low: '#ef4444',
};

export function AnimatedBusMarker({
  id, lat, lng, bearing, confidence, tooltip,
  selected = false, visible = true, onClick,
}: AnimatedBusMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<MapLibreGL.Marker | null>(null);
  const animRef = useRef<number>(0);
  const currentPos = useRef({ lat, lng, bearing });
  const tooltipRef = useRef<MapLibreGL.Popup | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const tooltipContainer = useMemo(() => document.createElement('div'), []);

  // Create marker once
  useEffect(() => {
    if (!map) return;

    const el = document.createElement('div');
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.cursor = 'pointer';
    el.style.transition = 'opacity 0.3s';
    elRef.current = el;

    const marker = new MapLibreGL.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .setRotation(bearing)
      .addTo(map);

    markerRef.current = marker;
    currentPos.current = { lat, lng, bearing };

    // Tooltip on hover
    const popup = new MapLibreGL.Popup({
      offset: 22,
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
    el.addEventListener('click', () => {
      onClickRef.current?.();
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      popup.remove();
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Visibility
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.style.opacity = visible ? '1' : '0';
    el.style.pointerEvents = visible ? 'auto' : 'none';
  }, [visible]);

  // Animate to new position
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const startPos = { ...currentPos.current };
    const startTime = performance.now();
    const duration = 3000;

    let bearingDiff = bearing - startPos.bearing;
    if (bearingDiff > 180) bearingDiff -= 360;
    if (bearingDiff < -180) bearingDiff += 360;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

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
  const size = selected ? 48 : 40;
  const strokeWidth = selected ? 3 : 0;

  return (
    <>
      {elRef.current && createPortal(
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible', transition: 'transform 0.2s', transform: selected ? 'scale(1.2)' : 'scale(1)' }}
        >
          {/* Selection ring */}
          {selected && (
            <circle cx="20" cy="20" r="19" stroke="white" strokeWidth="2.5" fill="none" opacity="0.9">
              <animate attributeName="r" values="17;19;17" dur="1.5s" repeatCount="indefinite" />
            </circle>
          )}
          {/* Pulse ring */}
          <circle cx="20" cy="20" r="18" fill={color} opacity="0.12">
            <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.06;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Bus body */}
          <rect x="12" y="9" width="16" height="24" rx="4" fill={color} stroke={selected ? 'white' : 'none'} strokeWidth={strokeWidth} />
          {/* Windshield */}
          <rect x="14" y="11" width="12" height="6" rx="2" fill="white" opacity="0.9" />
          {/* Side windows */}
          <rect x="14" y="19" width="5" height="4" rx="1" fill="white" opacity="0.5" />
          <rect x="21" y="19" width="5" height="4" rx="1" fill="white" opacity="0.5" />
          {/* Headlights */}
          <circle cx="15" cy="30" r="1.5" fill="white" opacity="0.8" />
          <circle cx="25" cy="30" r="1.5" fill="white" opacity="0.8" />
          {/* Direction arrow */}
          <path d="M20 4 L23 9 L17 9 Z" fill={color} />
        </svg>,
        elRef.current,
      )}
      {createPortal(
        <div className="bg-foreground text-background rounded-md px-2.5 py-1.5 text-xs shadow-lg">
          {tooltip}
        </div>,
        tooltipContainer,
      )}
    </>
  );
}
