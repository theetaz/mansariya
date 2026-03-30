import React from 'react';
import {StyleSheet} from 'react-native';
import MapLibreGL, {Logger} from '@maplibre/maplibre-react-native';
import {MAP_STYLE_URL, DEFAULT_CENTER, DEFAULT_ZOOM} from '../../constants/map';

// Initialize MapLibre (required before any map usage)
MapLibreGL.setAccessToken(null);

// Suppress non-fatal MapLibre font/style errors (OpenFreeMap doesn't serve all fonts)
Logger.setLogLevel('warning');
const originalError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('MapLibre error')) return;
  originalError(...args);
};

interface MapViewWrapperProps {
  children?: React.ReactNode;
  onPress?: (event: any) => void;
}

export default function MapViewWrapper({children, onPress}: MapViewWrapperProps) {
  return (
    <MapLibreGL.MapView
      style={styles.map}
      mapStyle={MAP_STYLE_URL}
      compassEnabled
      rotateEnabled={false}
      onPress={onPress}>
      <MapLibreGL.Camera
        defaultSettings={{
          centerCoordinate: DEFAULT_CENTER,
          zoomLevel: DEFAULT_ZOOM,
        }}
      />

      {/* User location — disabled animated to avoid AnimatedNode crash on RN 0.84 */}
      <MapLibreGL.UserLocation visible animated={false} />

      {children}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
