import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from '@/components/ui/map';
import maplibregl from 'maplibre-gl';
import type { DeviceClassification } from '@/lib/types';

const CLASSIFICATION_COLORS: Record<DeviceClassification, string> = {
  noise: '#6B7280',
  potential: '#BA7517',
  cluster: '#378ADD',
  confirmed: '#1D9E75',
};

interface DeviceArrowMarkerProps {
  id: string;
  lat: number;
  lng: number;
  bearing: number;
  speedKmh: number;
  classification: DeviceClassification;
  visible: boolean;
  selected: boolean;
  onClick: () => void;
  tooltip: string;
}

export function DeviceArrowMarker({
  id,
  lat,
  lng,
  bearing,
  speedKmh,
  classification,
  visible,
  selected,
  onClick,
  tooltip,
}: DeviceArrowMarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<{ lat: number; lng: number }>({ lat, lng });

  // Create marker element once
  useEffect(() => {
    if (!map) return;

    const el = document.createElement('div');
    el.dataset.deviceId = id;
    el.style.cursor = 'pointer';
    el.title = tooltip;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    elRef.current = el;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;
    animRef.current = { lat, lng };

    return () => {
      marker.remove();
      markerRef.current = null;
      elRef.current = null;
    };
  }, [id, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate position
  useEffect(() => {
    if (!markerRef.current) return;

    const start = animRef.current;
    const startTime = performance.now();
    const duration = 3000;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t * (2 - t); // ease-out quad
      const curLat = start.lat + (lat - start.lat) * ease;
      const curLng = start.lng + (lng - start.lng) * ease;
      markerRef.current?.setLngLat([curLng, curLat]);
      if (t < 1) requestAnimationFrame(animate);
      else animRef.current = { lat, lng };
    };

    requestAnimationFrame(animate);
  }, [lat, lng]);

  // Update tooltip
  useEffect(() => {
    if (elRef.current) elRef.current.title = tooltip;
  }, [tooltip]);

  // Toggle visibility
  useEffect(() => {
    if (elRef.current) {
      elRef.current.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);

  const color = CLASSIFICATION_COLORS[classification];
  const showDirectionalBearing = speedKmh >= 3 && Number.isFinite(bearing) && bearing > 0;

  if (!elRef.current) return null;

  return createPortal(
    showDirectionalBearing ? (
      <svg
        width="16"
        height="16"
        viewBox="0 0 14 14"
        style={{
          transform: `rotate(${bearing}deg)`,
          transition: 'transform 1s ease',
          filter: selected ? `drop-shadow(0 0 4px ${color})` : undefined,
        }}
      >
        <polygon
          points="7,1 13,12 7,9 1,12"
          fill={color}
          opacity={selected ? 1 : 0.85}
          stroke={selected ? '#fff' : 'none'}
          strokeWidth={selected ? 1 : 0}
        />
      </svg>
    ) : (
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          backgroundColor: color,
          opacity: selected ? 1 : 0.85,
          border: selected ? '2px solid white' : '1px solid rgba(255,255,255,0.75)',
          boxShadow: selected ? `0 0 4px ${color}` : undefined,
        }}
      />
    ),
    elRef.current,
  );
}
