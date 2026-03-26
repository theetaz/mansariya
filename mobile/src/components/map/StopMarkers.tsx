import React from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import {colors} from '../../constants/theme';
import {Stop} from '../../services/api';

interface StopMarkersProps {
  stops: Stop[];
  routeId: string;
}

/**
 * Renders bus stop markers along a route.
 * First stop = green, last = red, intermediate = blue (per design spec).
 */
export default function StopMarkers({stops, routeId}: StopMarkersProps) {
  if (stops.length === 0) return null;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: stops.map((stop, index) => ({
      type: 'Feature',
      id: stop.id,
      geometry: {
        type: 'Point',
        coordinates: stop.location,
      },
      properties: {
        name: stop.name_en,
        position: index === 0 ? 'first' : index === stops.length - 1 ? 'last' : 'mid',
      },
    })),
  };

  const circleColor: any = [
    'match',
    ['get', 'position'],
    'first', colors.green,
    'last', colors.red,
    colors.blue, // mid
  ];

  return (
    <MapLibreGL.ShapeSource id={`stops-${routeId}`} shape={geojson}>
      {/* White border */}
      <MapLibreGL.CircleLayer
        id={`stop-border-${routeId}`}
        style={{
          circleRadius: 6,
          circleColor: '#FFFFFF',
        }}
      />
      {/* Colored dot */}
      <MapLibreGL.CircleLayer
        id={`stop-dot-${routeId}`}
        style={{
          circleRadius: 4,
          circleColor: circleColor,
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
