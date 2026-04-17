import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';

import type {RootStackParamList} from '../navigation/types';
import {palette, radii, spacing} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useMapStore} from '../stores/useMapStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {startTracking, stopTracking} from '../services/locationTracker';
import Glass from '../components/common/Glass';
import {RouteBadge} from '../components/common/RouteBadge';
import ConfidenceDots from '../components/common/ConfidenceDots';
import LiveBadge from '../components/common/LiveBadge';
import MapView from '../components/map/MapView';
import BusMarkers from '../components/map/BusMarker';
import RoutePolyline from '../components/map/RoutePolyline';
import StopMarkers from '../components/map/StopMarkers';
import TripStartModal from '../components/TripStartModal';
import {useRouteOnMap} from '../hooks/useRouteOnMap';
import {useLiveBuses} from '../hooks/useLiveBuses';
import {useActiveRoutes} from '../hooks/useActiveRoutes';
import {useUserLocation} from '../hooks/useUserLocation';

// Tab bar (GlassTabBar) is ~84 when inset bottom ≈ 34 (iPhone with home bar).
// The sheet sits right above that; the bus chip floats just above the sheet.
const TAB_BAR_HEIGHT = 84;
const SHEET_MIN_HEIGHT = 140; // empty/collapsed sheet height

/**
 * Map Home — design handoff screen 06.
 *
 * Full-bleed map with three floating glass surfaces:
 *   1. Top — glass search bar + live count pill.
 *   2. Right — glass "I'm on a bus" chip just above the sheet.
 *   3. Bottom — glass "Nearby routes" sheet with per-route ETA.
 */
export default function MapScreen() {
  const {t} = useTranslation();
  const {isDark, surface} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const buses = useMapStore((s) => s.buses);
  const isTracking = useTrackingStore((s) => s.isTracking);

  const userLocation = useUserLocation();
  const activeRouteIds = useActiveRoutes(userLocation.lat, userLocation.lng);
  useLiveBuses(activeRouteIds);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const {stops: routeStops, polylineCoords} = useRouteOnMap(selectedRouteId);

  const [showTripModal, setShowTripModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      useMapStore.getState().removeStaleBuses(30000);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTrackingToggle = useCallback(async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (isTracking) {
        await stopTracking();
        useTrackingStore.getState().stopTracking();
      } else {
        setShowTripModal(true);
      }
    } finally {
      setIsToggling(false);
    }
  }, [isTracking, isToggling]);

  const handleStartWithMeta = useCallback(
    async (meta: {routeId?: string; busNumber?: string; crowdLevel?: number}) => {
      setShowTripModal(false);
      setIsToggling(true);
      try {
        const started = await startTracking({
          routeId: meta.routeId,
          busNumber: meta.busNumber,
          crowdLevel: meta.crowdLevel,
        });
        if (started) {
          useTrackingStore.getState().startTracking({
            routeId: meta.routeId ?? null,
            busNumber: meta.busNumber ?? null,
            crowdLevel: meta.crowdLevel ?? null,
          });
        }
      } finally {
        setIsToggling(false);
      }
    },
    [],
  );

  const handleSkipMeta = useCallback(async () => {
    setShowTripModal(false);
    setIsToggling(true);
    try {
      const started = await startTracking();
      if (started) useTrackingStore.getState().startTracking();
    } finally {
      setIsToggling(false);
    }
  }, []);

  const busEntries = useMemo(() => Object.values(buses), [buses]);

  const stopMarkersData = useMemo(
    () =>
      routeStops.map((s) => ({
        id: s.stop_id,
        name_en: s.stop_name_en,
        name_si: s.stop_name_si,
        location: [s.stop_lng, s.stop_lat] as [number, number],
      })),
    [routeStops],
  );

  // Group buses by route for the sheet summary.
  const routeSummaries = useMemo(() => {
    const byRoute = new Map<string, typeof busEntries>();
    busEntries.forEach((bus) => {
      const list = byRoute.get(bus.route_id) || [];
      list.push(bus);
      byRoute.set(bus.route_id, list);
    });
    return Array.from(byRoute.entries()).map(([routeId, list]) => {
      const nearest = list[0];
      const confLevel =
        nearest.confidence === 'verified'
          ? 3
          : nearest.confidence === 'good'
            ? 2
            : 1;
      return {
        routeId,
        buses: list.length,
        confidence: confLevel as 1 | 2 | 3,
        speedKmh: nearest.speed_kmh,
      };
    });
  }, [busEntries]);

  // Live count pulse dot.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [pulse]);
  const pulseDot = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{scale: 1 + pulse.value * 0.4}],
  }));

  return (
    <View style={[styles.root, {backgroundColor: surface.bg}]}>
      {/* Map */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          centerCoordinate={
            userLocation.loading
              ? undefined
              : [userLocation.lng, userLocation.lat]
          }>
          {selectedRouteId && polylineCoords.length >= 2 && (
            <RoutePolyline
              coordinates={polylineCoords}
              routeId={selectedRouteId}
            />
          )}
          {selectedRouteId && stopMarkersData.length > 0 && (
            <StopMarkers stops={stopMarkersData} routeId={selectedRouteId} />
          )}
          <BusMarkers
            buses={busEntries}
            onBusPress={(bus) => setSelectedRouteId(bus.route_id)}
          />
        </MapView>
      </View>

      {/* Top glass — search bar + live count pill */}
      <View
        pointerEvents="box-none"
        style={[styles.topStack, {paddingTop: insets.top + 12}]}>
        <Pressable
          onPress={() => navigation.navigate('JourneySearch')}
          style={({pressed}) => [
            styles.searchWrap,
            {transform: [{scale: pressed ? 0.99 : 1}]},
          ]}>
          <Glass radius={radii.xl} intensity={60}>
            <View style={styles.searchInner}>
              <Ionicons
                name="search"
                size={18}
                color={surface.textDim}
                style={{marginRight: 10}}
              />
              <Text style={[styles.searchPlaceholder, {color: surface.textDim}]}>
                {t('map.search_placeholder', 'Where are you going?')}
              </Text>
              <View style={{flex: 1}} />
              <View
                style={[
                  styles.sparkleChip,
                  {
                    backgroundColor: isDark
                      ? 'rgba(29,158,117,0.22)'
                      : palette.greenSoft,
                  },
                ]}>
                <Ionicons name="sparkles" size={15} color={palette.emerald} />
              </View>
            </View>
          </Glass>
        </Pressable>

        {busEntries.length > 0 && (
          <View style={styles.livePillWrap}>
            <Glass radius={radii.pill} intensity={50}>
              <View style={styles.livePillInner}>
                <Animated.View
                  style={[
                    styles.livePulse,
                    {backgroundColor: palette.coral},
                    pulseDot,
                  ]}
                />
                <Text
                  style={[
                    styles.livePillText,
                    {color: surface.text},
                  ]}>
                  {busEntries.length}{' '}
                  {t(
                    busEntries.length === 1 ? 'map.live_bus' : 'map.live_buses',
                    busEntries.length === 1 ? 'live bus' : 'live buses',
                  )}
                </Text>
              </View>
            </Glass>
          </View>
        )}
      </View>

      {/* "I'm on a bus" glass chip — right side, just above the sheet */}
      <View
        pointerEvents="box-none"
        style={[
          styles.busChipWrap,
          {bottom: TAB_BAR_HEIGHT + SHEET_MIN_HEIGHT + 22},
        ]}>
        <Pressable
          onPress={handleTrackingToggle}
          style={({pressed}) => [{transform: [{scale: pressed ? 0.96 : 1}]}]}>
          <Glass radius={radii.pill} intensity={60}>
            <View style={styles.busChipInner}>
              <LinearGradient
                colors={
                  isTracking
                    ? [palette.coral, '#B8453A']
                    : [palette.green, palette.emerald]
                }
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.busChipIconCircle}>
                <Ionicons
                  name={isTracking ? 'stop' : 'bus'}
                  size={18}
                  color="#FFFFFF"
                />
              </LinearGradient>
              <Text style={[styles.busChipLabel, {color: surface.text}]}>
                {isTracking
                  ? t('map.stop_tracking', 'Stop sharing')
                  : t('map.im_on_a_bus', "I'm on a bus")}
              </Text>
            </View>
          </Glass>
        </Pressable>
      </View>

      {/* Glass bottom sheet — Nearby routes */}
      <View
        pointerEvents="box-none"
        style={[
          styles.sheetWrap,
          {bottom: TAB_BAR_HEIGHT + 10},
        ]}>
        <Glass radius={radii.xxl} intensity={80}>
          <View style={styles.sheetInner}>
            <View
              style={[styles.handle, {backgroundColor: surface.hairline}]}
            />
            <View style={styles.sheetHeader}>
              <View style={{flex: 1}}>
                <Text style={[styles.sheetTitle, {color: surface.text}]}>
                  {t('map.nearby_routes', 'Nearby routes')}
                </Text>
                {routeSummaries.length > 0 ? (
                  <Text style={[styles.sheetSub, {color: surface.textDim}]}>
                    {routeSummaries.length}{' '}
                    {t(
                      routeSummaries.length === 1
                        ? 'map.route'
                        : 'map.routes',
                      routeSummaries.length === 1 ? 'route' : 'routes',
                    )}{' '}
                    · {t('map.updated_now', 'updated now')}
                  </Text>
                ) : (
                  <Text style={[styles.sheetSub, {color: surface.textDim}]}>
                    {t('map.waiting_live', 'Waiting for live buses…')}
                  </Text>
                )}
              </View>
              {routeSummaries.length > 0 ? (
                <Pressable
                  onPress={() => navigation.navigate('JourneySearch')}>
                  <Text style={styles.seeAll}>
                    {t('map.see_all', 'See all')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {routeSummaries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyHint, {color: surface.textSoft}]}>
                  {t(
                    'map.no_buses_hint',
                    'Ride a bus with the app open to help the network.',
                  )}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{maxHeight: 200}}
                showsVerticalScrollIndicator={false}>
                {routeSummaries.map((r, i) => {
                  const color = routeColorForIndex(i);
                  return (
                    <Pressable
                      key={r.routeId}
                      onPress={() => {
                        if (selectedRouteId === r.routeId) {
                          navigation.navigate('RouteDetail', {
                            routeId: r.routeId,
                          });
                        } else {
                          setSelectedRouteId(r.routeId);
                        }
                      }}
                      style={({pressed}) => [
                        styles.routeRow,
                        {
                          borderTopColor: surface.hairline,
                          borderTopWidth:
                            i > 0 ? StyleSheet.hairlineWidth : 0,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <RouteBadge num={r.routeId} color={color} size="md" />
                      <View style={styles.routeMeta}>
                        <Text
                          numberOfLines={1}
                          style={[styles.routeName, {color: surface.text}]}>
                          Route {r.routeId}
                        </Text>
                        <View style={styles.routeSubRow}>
                          <Text
                            style={[
                              styles.routeSub,
                              {color: surface.textDim},
                            ]}>
                            {r.buses} live ·{' '}
                          </Text>
                          <ConfidenceDots level={r.confidence} showLabel={false} />
                        </View>
                      </View>
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={[styles.eta, {color}]}>
                          {Math.max(1, Math.round(r.speedKmh))} km/h
                        </Text>
                        <Text style={[styles.etaLabel, {color: surface.textDim}]}>
                          LIVE
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Glass>
      </View>

      {/* Active tracking indicator (live chip) — top-right under the search */}
      {isTracking && (
        <View
          pointerEvents="none"
          style={[styles.trackingMark, {top: insets.top + 82}]}>
          <LiveBadge kind="reporting" label="Reporting" />
        </View>
      )}

      <TripStartModal
        visible={showTripModal}
        onStart={handleStartWithMeta}
        onSkip={handleSkipMeta}
        onCancel={() => setShowTripModal(false)}
      />
    </View>
  );
}

// Palette rotation for route colors — emerald / amber / road blue / coral.
function routeColorForIndex(i: number) {
  const palette = ['#0F6E56', '#E89A3C', '#378ADD', '#185FA5', '#E56A57'];
  return palette[i % palette.length];
}

const styles = StyleSheet.create({
  root: {flex: 1},

  topStack: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
  },
  searchWrap: {},
  searchInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchPlaceholder: {
    fontSize: 15,
    fontWeight: '500',
  },
  sparkleChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  livePillWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  livePillInner: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  livePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  busChipWrap: {
    position: 'absolute',
    right: spacing.lg,
  },
  busChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 10,
    gap: 8,
  },
  busChipIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  busChipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  sheetWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
  },
  sheetInner: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 11,
    marginTop: 2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.green,
  },
  empty: {
    paddingVertical: 10,
    paddingBottom: 6,
  },
  emptyHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  routeMeta: {
    flex: 1,
    minWidth: 0,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  routeSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  routeSub: {
    fontSize: 11,
  },
  eta: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  etaLabel: {
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 1,
  },

  trackingMark: {
    position: 'absolute',
    right: spacing.lg,
  },
});
