import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {colors, spacing, typography} from '../constants/theme';
import {useMapStore} from '../stores/useMapStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {startTracking, stopTracking} from '../services/locationTracker';
import BottomSheet, {SHEET_HEIGHT} from '../components/common/BottomSheet';
import RouteCard from '../components/route/RouteCard';
import MapView from '../components/map/MapView';
import BusMarkers from '../components/map/BusMarker';
import RoutePolyline from '../components/map/RoutePolyline';
import StopMarkers from '../components/map/StopMarkers';
import ConfidenceDots from '../components/common/ConfidenceDots';
import TripStartModal from '../components/TripStartModal';
import {useRouteOnMap} from '../hooks/useRouteOnMap';
import {useLiveBuses} from '../hooks/useLiveBuses';
import {useActiveRoutes} from '../hooks/useActiveRoutes';
import {useTheme} from '../hooks/useTheme';

export default function MapScreen() {
  const {t} = useTranslation();
  const {colors: tc} = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const buses = useMapStore((s) => s.buses);
  const isTracking = useTrackingStore((s) => s.isTracking);
  const detectedRouteName = useTrackingStore((s) => s.detectedRouteName);

  // Fetch active routes and subscribe to their WebSocket channels
  const activeRouteIds = useActiveRoutes();
  useLiveBuses(activeRouteIds);

  const [showTripModal, setShowTripModal] = useState(false);

  // Periodically remove stale buses (not updated for 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      useMapStore.getState().removeStaleBuses(30000);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Selected route — shows polyline + stops on map
  const [selectedRouteId, setSelectedRouteId] = React.useState<string | null>(null);
  const {stops: routeStops, polylineCoords} = useRouteOnMap(selectedRouteId);

  // Convert enriched stops to Stop format for StopMarkers
  const stopMarkersData = routeStops.map((s) => ({
    id: s.stop_id,
    name_en: s.stop_name_en,
    name_si: s.stop_name_si,
    location: [s.stop_lng, s.stop_lat] as [number, number],
  }));

  const handleTrackingToggle = useCallback(() => {
    if (isTracking) {
      stopTracking();
      useTrackingStore.getState().stopTracking();
    } else {
      setShowTripModal(true);
    }
  }, [isTracking]);

  const handleStartWithMeta = useCallback((meta: {routeId?: string; busNumber?: string; crowdLevel?: number}) => {
    setShowTripModal(false);
    startTracking({routeId: meta.routeId, busNumber: meta.busNumber, crowdLevel: meta.crowdLevel});
    useTrackingStore.getState().startTracking({
      routeId: meta.routeId ?? null,
      busNumber: meta.busNumber ?? null,
      crowdLevel: meta.crowdLevel ?? null,
    });
  }, []);

  const handleSkipMeta = useCallback(() => {
    setShowTripModal(false);
    startTracking();
    useTrackingStore.getState().startTracking();
  }, []);

  const busEntries = Object.values(buses);

  // Group buses by route for the bottom sheet
  const busByRoute = new Map<string, typeof busEntries>();
  busEntries.forEach((bus) => {
    const list = busByRoute.get(bus.route_id) || [];
    list.push(bus);
    busByRoute.set(bus.route_id, list);
  });

  const routeSummaries = Array.from(busByRoute.entries()).map(
    ([routeId, routeBuses]) => ({
      routeId,
      busCount: routeBuses.length,
      nearestBus: routeBuses[0],
    }),
  );

  return (
    <View style={styles.container}>
      {/* MapLibre map with live bus markers */}
      <View style={styles.mapArea}>
        <MapView>
          {/* Selected route polyline + stops */}
          {selectedRouteId && polylineCoords.length >= 2 && (
            <RoutePolyline
              coordinates={polylineCoords}
              routeId={selectedRouteId}
            />
          )}
          {selectedRouteId && stopMarkersData.length > 0 && (
            <StopMarkers
              stops={stopMarkersData}
              routeId={selectedRouteId}
            />
          )}

          {/* Live bus markers */}
          <BusMarkers
            buses={busEntries}
            onBusPress={(bus) => {
              setSelectedRouteId(bus.route_id);
            }}
          />
        </MapView>

        {/* Live bus count overlay */}
        {busEntries.length > 0 && (
          <View style={[styles.busCountOverlay, {backgroundColor: tc.card}]}>
            <View style={styles.liveDot} />
            <Text style={[styles.busCountText, {color: tc.text}]}>
              {busEntries.length} live bus{busEntries.length > 1 ? 'es' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Tracking banner */}
      {isTracking && (
        <View style={styles.trackingBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.trackingText}>
            {detectedRouteName
              ? t('tracking.detected', {route: detectedRouteName})
              : t('tracking.detecting')}
          </Text>
        </View>
      )}

      {/* FAB: I'm on a bus */}
      <TouchableOpacity
        style={[styles.fab, isTracking && styles.fabStop]}
        onPress={handleTrackingToggle}
        activeOpacity={0.8}>
        <Text style={styles.fabIcon}>{isTracking ? '■' : '🚌'}</Text>
      </TouchableOpacity>

      <TripStartModal
        visible={showTripModal}
        onStart={handleStartWithMeta}
        onSkip={handleSkipMeta}
        onCancel={() => setShowTripModal(false)}
      />

      {/* Bottom sheet — nearby buses grouped by route */}
      <BottomSheet>
        <Text style={[styles.sheetTitle, {color: tc.text}]}>{t('map.nearby_routes')}</Text>

        {routeSummaries.length === 0 ? (
          <View style={styles.emptySheet}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={[styles.emptyText, {color: tc.textSecondary}]}>{t('map.no_buses')}</Text>
            <Text style={[styles.emptyHint, {color: tc.textTertiary}]}>Waiting for live data...</Text>
          </View>
        ) : (
          routeSummaries.map((item) => (
            <TouchableOpacity
              key={item.routeId}
              style={[styles.liveRouteCard, {borderBottomColor: tc.divider}]}
              onPress={() => {
                // First tap: show route on map. Second tap: open detail.
                if (selectedRouteId === item.routeId) {
                  navigation.navigate('RouteDetail', {routeId: item.routeId});
                } else {
                  setSelectedRouteId(item.routeId);
                }
              }}
              activeOpacity={0.7}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{item.routeId}</Text>
              </View>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeName, {color: tc.text}]}>Route {item.routeId}</Text>
                <Text style={[styles.routeMeta, {color: tc.textSecondary}]}>
                  {item.busCount} bus{item.busCount > 1 ? 'es' : ''} ·{' '}
                  {item.nearestBus.speed_kmh.toFixed(0)} km/h
                </Text>
              </View>
              <ConfidenceDots
                level={item.nearestBus.confidence}
                showLabel={false}
              />
            </TouchableOpacity>
          ))
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.surface},
  mapArea: {flex: 1},
  busCountOverlay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    marginRight: 8,
  },
  busCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral900,
  },
  trackingBanner: {
    position: 'absolute',
    top: 110,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.greenLight,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.green + '30',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    marginRight: spacing.sm,
  },
  trackingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.greenDark,
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: SHEET_HEIGHT + spacing.lg,
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabStop: {backgroundColor: colors.red},
  fabIcon: {fontSize: 22},
  sheetTitle: {
    ...typography.h2,
    color: colors.neutral900,
    marginBottom: spacing.sm,
  },
  liveRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral200,
  },
  routeBadge: {
    minWidth: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginRight: 12,
  },
  routeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.greenDark,
  },
  routeInfo: {flex: 1},
  routeName: {fontSize: 15, fontWeight: '600', color: colors.neutral900},
  routeMeta: {fontSize: 12, color: colors.neutral500, marginTop: 2},
  emptySheet: {paddingVertical: 20, alignItems: 'center'},
  emptyIcon: {fontSize: 32, marginBottom: 8},
  emptyText: {...typography.body, color: colors.neutral500},
  emptyHint: {fontSize: 12, color: colors.neutral300, marginTop: 4},
});
