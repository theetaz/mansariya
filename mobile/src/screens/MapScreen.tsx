import React from 'react';
import {View, StyleSheet, TouchableOpacity, Text} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useMapStore} from '../stores/useMapStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {startTracking, stopTracking} from '../services/locationTracker';

// TODO: Import and configure MapLibre when native modules are linked
// import MapLibreGL from '@maplibre/maplibre-react-native';

export default function MapScreen() {
  const {t} = useTranslation();
  const selectedRouteId = useMapStore((s) => s.selectedRouteId);
  const buses = useMapStore((s) => s.buses);
  const isTracking = useTrackingStore((s) => s.isTracking);
  const detectedRouteName = useTrackingStore((s) => s.detectedRouteName);

  const handleTrackingToggle = () => {
    if (isTracking) {
      stopTracking();
      useTrackingStore.getState().stopTracking();
    } else {
      startTracking();
      useTrackingStore.getState().startTracking();
    }
  };

  const busCount = Object.keys(buses).length;

  return (
    <View style={styles.container}>
      {/* Map placeholder — replace with MapLibre when native modules are linked */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>MapLibre Map</Text>
        <Text style={styles.placeholderSubtext}>
          {busCount > 0
            ? `${busCount} live bus${busCount > 1 ? 'es' : ''}`
            : t('map.no_buses')}
        </Text>
        {selectedRouteId && (
          <Text style={styles.placeholderSubtext}>
            Viewing Route {selectedRouteId}
          </Text>
        )}
      </View>

      {/* Tracking indicator */}
      {isTracking && (
        <View style={styles.trackingBanner}>
          <Text style={styles.trackingText}>
            {detectedRouteName
              ? t('tracking.detected', {route: detectedRouteName})
              : t('tracking.detecting')}
          </Text>
        </View>
      )}

      {/* FAB: I'm on a bus */}
      <TouchableOpacity
        style={[styles.fab, isTracking && styles.fabActive]}
        onPress={handleTrackingToggle}
        activeOpacity={0.8}>
        <Text style={styles.fabIcon}>{isTracking ? '■' : '🚌'}</Text>
        <Text style={styles.fabText}>
          {isTracking ? t('map.stop_tracking') : t('map.im_on_bus')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
  },
  placeholderText: {fontSize: 24, color: '#999', fontWeight: '600'},
  placeholderSubtext: {fontSize: 14, color: '#aaa', marginTop: 4},
  trackingBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  trackingText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#16A34A',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabActive: {backgroundColor: '#DC2626'},
  fabIcon: {fontSize: 20, marginRight: 8},
  fabText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
