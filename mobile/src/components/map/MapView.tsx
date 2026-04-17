import React from 'react';
import {StyleSheet} from 'react-native';
import MapLibreGL, {Logger} from '@maplibre/maplibre-react-native';
import {MAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM} from '../../constants/map';
import {useTheme} from '../../hooks/useTheme';

// Initialize MapLibre (required before any map usage)
MapLibreGL.setAccessToken(null);

// Suppress non-fatal MapLibre font/style errors
Logger.setLogLevel('warning');
const originalError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('MapLibre error')) return;
  originalError(...args);
};

interface MapViewWrapperProps {
  children?: React.ReactNode;
  onPress?: (event: any) => void;
  centerCoordinate?: [number, number]; // [lng, lat]
}

export default function MapViewWrapper({children, onPress, centerCoordinate}: MapViewWrapperProps) {
  const {isDark} = useTheme();
  const mapStyle = isDark ? MAP_STYLES.dark : MAP_STYLES.light;
  const center = centerCoordinate ?? DEFAULT_CENTER;

  return (
    <MapLibreGL.MapView
      style={styles.map}
      mapStyle={mapStyle}
      compassEnabled
      rotateEnabled={false}
      onPress={onPress}>
      <MapLibreGL.Camera
        defaultSettings={{
          centerCoordinate: center,
          zoomLevel: DEFAULT_ZOOM,
        }}
      />

      <MapLibreGL.UserLocation visible animated />

      {children}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
