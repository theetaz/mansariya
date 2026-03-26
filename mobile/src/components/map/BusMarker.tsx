import React from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import {colors} from '../../constants/theme';
import {BusPosition} from '../../services/api';

interface BusMarkersProps {
  buses: BusPosition[];
  onBusPress?: (bus: BusPosition) => void;
}

/**
 * Renders all live bus positions as circle markers with route number labels.
 * Uses ShapeSource + CircleLayer + SymbolLayer for performance.
 */
export default function BusMarkers({buses, onBusPress}: BusMarkersProps) {
  if (buses.length === 0) return null;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: buses.map((bus) => ({
      type: 'Feature',
      id: bus.virtual_id,
      geometry: {
        type: 'Point',
        coordinates: [bus.lng, bus.lat],
      },
      properties: {
        id: bus.virtual_id,
        routeId: bus.route_id,
        confidence: bus.confidence,
        speed: bus.speed_kmh,
        contributors: bus.contributor_count,
      },
    })),
  };

  const circleColor: any = [
    'match',
    ['get', 'confidence'],
    'verified', colors.confidenceVerified,
    'good', colors.confidenceGood,
    colors.confidenceApproximate,
  ];

  const circleOpacity: any = [
    'match',
    ['get', 'confidence'],
    'verified', 1.0,
    'good', 0.85,
    0.6,
  ];

  return (
    <MapLibreGL.ShapeSource
      id="bus-positions"
      shape={geojson}
      onPress={(e) => {
        if (onBusPress && e.features?.[0]?.properties) {
          const props = e.features[0].properties;
          const bus = buses.find((b) => b.virtual_id === props.id);
          if (bus) onBusPress(bus);
        }
      }}>
      {/* White border circle */}
      <MapLibreGL.CircleLayer
        id="bus-border"
        style={{
          circleRadius: 16,
          circleColor: '#FFFFFF',
          circleOpacity: circleOpacity,
        }}
      />
      {/* Colored fill circle */}
      <MapLibreGL.CircleLayer
        id="bus-fill"
        style={{
          circleRadius: 14,
          circleColor: circleColor,
          circleOpacity: circleOpacity,
        }}
      />
      {/* Route number label — no custom font (uses map default) */}
      <MapLibreGL.SymbolLayer
        id="bus-label"
        style={{
          textField: ['get', 'routeId'],
          textSize: 10,
          textColor: '#FFFFFF',
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
