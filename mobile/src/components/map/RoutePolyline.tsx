import React from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import {colors} from '../../constants/theme';

interface RoutePolylineProps {
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  coordinates: [number, number][];
  routeId: string;
}

/**
 * Renders a bus route polyline on the map.
 * Blue line, 4dp width, 70% opacity per design spec.
 */
export default function RoutePolyline({coordinates, routeId}: RoutePolylineProps) {
  if (coordinates.length < 2) return null;

  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };

  return (
    <MapLibreGL.ShapeSource id={`route-${routeId}`} shape={geojson}>
      <MapLibreGL.LineLayer
        id={`route-line-${routeId}`}
        style={{
          lineColor: colors.blue,
          lineWidth: 4,
          lineOpacity: 0.7,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
