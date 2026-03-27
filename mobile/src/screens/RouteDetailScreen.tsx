import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';
import {fetchRouteDetail, fetchRouteStops, Route, EnrichedRouteStop} from '../services/api';
import {useSavedStore} from '../stores/useSavedStore';
import {useBusPositions} from '../hooks/useBusPositions';
import {useRouteOnMap} from '../hooks/useRouteOnMap';
import {useMapStore} from '../stores/useMapStore';
import {colors, spacing, radii} from '../constants/theme';
import RouteNumberBadge from '../components/common/RouteNumberBadge';
import ConfidenceDots from '../components/common/ConfidenceDots';
import Button from '../components/common/Button';
import MapView from '../components/map/MapView';
import RoutePolyline from '../components/map/RoutePolyline';
import StopMarkers from '../components/map/StopMarkers';
import BusMarkers from '../components/map/BusMarker';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

type ViewMode = 'map' | 'stops';

export default function RouteDetailScreen() {
  const {t} = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetail'>>();
  const {routeId} = route.params;

  const [routeData, setRouteData] = useState<Route | null>(null);
  const [stops, setStops] = useState<EnrichedRouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  const addRoute = useSavedStore((s) => s.addRoute);
  const removeRoute = useSavedStore((s) => s.removeRoute);
  const isSaved = useSavedStore((s) => s.isSaved(routeId));
  const buses = useMapStore((s) => s.buses);

  useBusPositions(routeId);
  const {polylineCoords, stops: routeStops} = useRouteOnMap(routeId);

  const activeBuses = Object.values(buses).filter((b) => b.route_id === routeId);
  const selectedBus = selectedBusId
    ? activeBuses.find((b) => b.virtual_id === selectedBusId)
    : activeBuses[0];

  const stopMarkersData = routeStops.map((s) => ({
    id: s.stop_id,
    name_en: s.stop_name_en,
    location: [s.stop_lng, s.stop_lat] as [number, number],
  }));

  useEffect(() => {
    loadRoute();
  }, [routeId]);

  const loadRoute = async () => {
    try {
      const [detailResp, stopsResp] = await Promise.all([
        fetchRouteDetail(routeId),
        fetchRouteStops(routeId),
      ]);
      setRouteData(detailResp.route);
      setStops(stopsResp || []);
    } catch {}
    setLoading(false);
  };

  const toggleSaved = () => {
    if (!routeData) return;
    isSaved ? removeRoute(routeId) : addRoute(routeData);
  };

  const getBusStopIndex = (busLat: number, busLng: number): number => {
    if (stops.length === 0) return -1;
    let minDist = Infinity;
    let bestIdx = 0;
    stops.forEach((s, i) => {
      const dist = Math.sqrt(
        Math.pow(s.stop_lat - busLat, 2) + Math.pow(s.stop_lng - busLng, 2),
      );
      if (dist < minDist) { minDist = dist; bestIdx = i; }
    });
    return bestIdx;
  };

  const busAtStopIdx = selectedBus ? getBusStopIndex(selectedBus.lat, selectedBus.lng) : -1;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!routeData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
        <Button title={t('common.retry')} onPress={loadRoute} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <RouteNumberBadge
          routeNumber={routeData.id}
          serviceType={(routeData.service_type as any) ?? 'Normal'}
          size="large"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.routeName}>{routeData.name_en}</Text>
          <Text style={styles.routeNameLocal}>{routeData.name_si}</Text>
        </View>
        <TouchableOpacity onPress={toggleSaved}>
          <Text style={styles.saveIcon}>{isSaved ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* Segment control: Map | Stops */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'map' && styles.segmentActive]}
          onPress={() => setViewMode('map')}>
          <Text style={[styles.segmentText, viewMode === 'map' && styles.segmentTextActive]}>
            🗺️ Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'stops' && styles.segmentActive]}
          onPress={() => setViewMode('stops')}>
          <Text style={[styles.segmentText, viewMode === 'stops' && styles.segmentTextActive]}>
            📍 Stops
          </Text>
        </TouchableOpacity>
      </View>

      {/* MAP VIEW */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView>
            {polylineCoords.length >= 2 && (
              <RoutePolyline coordinates={polylineCoords} routeId={routeId} />
            )}
            {stopMarkersData.length > 0 && (
              <StopMarkers stops={stopMarkersData} routeId={routeId} />
            )}
            <BusMarkers
              buses={activeBuses}
              onBusPress={(bus) => setSelectedBusId(bus.virtual_id)}
            />
          </MapView>

          {/* Bus info overlay */}
          {selectedBus && (
            <View style={styles.busOverlay}>
              <View style={styles.busOverlayContent}>
                <Text style={styles.busOverlaySpeed}>
                  {selectedBus.speed_kmh.toFixed(0)} km/h
                </Text>
                <ConfidenceDots level={selectedBus.confidence} />
              </View>
              <Text style={styles.busOverlayMeta}>
                {selectedBus.contributor_count} contributor{selectedBus.contributor_count > 1 ? 's' : ''} · Route {routeId}
              </Text>
            </View>
          )}

          {/* Bus selector (when multiple buses) */}
          {activeBuses.length > 1 && (
            <ScrollView horizontal style={styles.busSelector} showsHorizontalScrollIndicator={false}>
              {activeBuses.map((bus) => (
                <TouchableOpacity
                  key={bus.virtual_id}
                  style={[
                    styles.busSelectorItem,
                    selectedBusId === bus.virtual_id && styles.busSelectorActive,
                  ]}
                  onPress={() => setSelectedBusId(bus.virtual_id)}>
                  <Text style={styles.busSelectorText}>
                    🚌 {bus.speed_kmh.toFixed(0)} km/h
                  </Text>
                  <ConfidenceDots level={bus.confidence} showLabel={false} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        /* STOPS VIEW */
        <ScrollView style={styles.stopsContainer}>
          {/* Quick stats */}
          <View style={styles.statsRow}>
            {routeData.frequency_minutes ? (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>~{routeData.frequency_minutes}</Text>
                <Text style={styles.statLabel}>min freq</Text>
              </View>
            ) : null}
            {routeData.fare_lkr ? (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>Rs.{routeData.fare_lkr}</Text>
                <Text style={styles.statLabel}>Fare</Text>
              </View>
            ) : null}
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stops.length}</Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.shareButton} onPress={() => {
              Share.share({
                message: `Route ${routeData.id}: ${routeData.name_en} — Track live on Mansariya`,
              });
            }}>
              <Text style={styles.shareText}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaved && styles.saveButtonActive]}
              onPress={toggleSaved}>
              <Text style={styles.saveButtonText}>{isSaved ? '★ Saved' : '☆ Save'}</Text>
            </TouchableOpacity>
          </View>

          {/* Active buses */}
          {activeBuses.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {activeBuses.length} BUS{activeBuses.length > 1 ? 'ES' : ''} ACTIVE
              </Text>
              {activeBuses.map((bus) => (
                <TouchableOpacity
                  key={bus.virtual_id}
                  style={styles.busCard}
                  onPress={() => { setSelectedBusId(bus.virtual_id); setViewMode('map'); }}>
                  <View>
                    <Text style={styles.busSpeed}>{bus.speed_kmh.toFixed(0)} km/h</Text>
                    <Text style={styles.busContrib}>
                      {bus.contributor_count} contributor{bus.contributor_count > 1 ? 's' : ''} · Tap to view on map
                    </Text>
                  </View>
                  <ConfidenceDots level={bus.confidence} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Stop timeline */}
          <Text style={styles.sectionTitle}>STOPS ({stops.length})</Text>
          {stops.map((stop, index) => {
            const isFirst = index === 0;
            const isLast = index === stops.length - 1;
            const isPassed = busAtStopIdx >= 0 && index < busAtStopIdx;
            const isCurrent = index === busAtStopIdx;

            return (
              <View key={stop.stop_id} style={styles.stopRow}>
                <View style={styles.timeline}>
                  <View style={[
                    styles.dot,
                    isFirst && styles.dotOrigin,
                    isLast && styles.dotDest,
                    isPassed && styles.dotPassed,
                    isCurrent && styles.dotCurrent,
                  ]} />
                  {!isLast && <View style={[styles.line, isPassed && styles.linePassed]} />}
                  {isCurrent && <View style={styles.busIcon}><Text style={{fontSize: 20}}>🚌</Text></View>}
                </View>
                <View style={styles.stopInfo}>
                  <Text style={[
                    styles.stopName,
                    isPassed && styles.stopPassed,
                    isCurrent && styles.stopCurrent,
                  ]}>{stop.stop_name_en}</Text>
                  {stop.stop_name_si ? <Text style={styles.stopLocal}>{stop.stop_name_si}</Text> : null}
                </View>
              </View>
            );
          })}
          <View style={{height: 40}} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16},
  errorText: {fontSize: 15, color: colors.neutral500},
  header: {
    flexDirection: 'row', padding: spacing.lg, alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: colors.neutral200,
  },
  headerInfo: {flex: 1, marginLeft: spacing.md},
  routeName: {fontSize: 18, fontWeight: '700', color: colors.neutral900},
  routeNameLocal: {fontSize: 13, color: colors.neutral500, marginTop: 2},
  saveIcon: {fontSize: 28, color: colors.amber, padding: spacing.sm},
  // Segment control
  segmentContainer: {
    flexDirection: 'row', margin: spacing.md, backgroundColor: colors.neutral100,
    borderRadius: radii.md, padding: 3,
  },
  segment: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.sm,
  },
  segmentActive: {backgroundColor: colors.background, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2},
  segmentText: {fontSize: 14, fontWeight: '500', color: colors.neutral500},
  segmentTextActive: {color: colors.neutral900, fontWeight: '600'},
  // Map view
  mapContainer: {flex: 1},
  busOverlay: {
    position: 'absolute', bottom: 80, left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.lg,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  busOverlayContent: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  busOverlaySpeed: {fontSize: 22, fontWeight: '700', color: colors.neutral900},
  busOverlayMeta: {fontSize: 12, color: colors.neutral500, marginTop: 4},
  busSelector: {
    position: 'absolute', bottom: 16, left: 0, right: 0, paddingHorizontal: spacing.lg,
  },
  busSelectorItem: {
    backgroundColor: colors.background, borderRadius: radii.md, padding: spacing.md,
    marginRight: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  busSelectorActive: {borderWidth: 2, borderColor: colors.green},
  busSelectorText: {fontSize: 13, fontWeight: '600', color: colors.neutral900},
  // Stops view
  stopsContainer: {flex: 1},
  statsRow: {flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm},
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, alignItems: 'center',
  },
  statValue: {fontSize: 18, fontWeight: '700', color: colors.neutral900},
  statLabel: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  actionRow: {flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md},
  shareButton: {
    flex: 1, backgroundColor: colors.green, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  shareText: {color: '#fff', fontWeight: '600', fontSize: 14},
  saveButton: {
    flex: 1, borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center',
  },
  saveButtonActive: {borderColor: colors.amber, backgroundColor: colors.amberLight},
  saveButtonText: {fontWeight: '600', fontSize: 14, color: colors.neutral700},
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: colors.neutral500, letterSpacing: 0.3,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textTransform: 'uppercase',
  },
  busCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.greenLight, borderRadius: radii.md, padding: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  busSpeed: {fontSize: 15, fontWeight: '600', color: colors.neutral900},
  busContrib: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  stopRow: {flexDirection: 'row', paddingHorizontal: spacing.lg},
  timeline: {width: 30, alignItems: 'center'},
  dot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: colors.neutral300,
    borderWidth: 2, borderColor: colors.neutral200, marginTop: 4, zIndex: 2,
  },
  dotOrigin: {backgroundColor: colors.green, borderColor: colors.greenDark},
  dotDest: {backgroundColor: colors.red, borderColor: colors.red},
  dotPassed: {backgroundColor: colors.green, borderColor: colors.green},
  dotCurrent: {
    backgroundColor: colors.green, borderColor: colors.greenDark,
    width: 18, height: 18, borderRadius: 9, borderWidth: 3, marginLeft: -2,
  },
  line: {width: 3, flex: 1, backgroundColor: colors.neutral200, marginVertical: 2, minHeight: 30},
  linePassed: {backgroundColor: colors.green},
  busIcon: {position: 'absolute', left: -12, top: -2, zIndex: 3},
  stopInfo: {flex: 1, paddingBottom: spacing.lg, paddingLeft: spacing.sm},
  stopName: {fontSize: 15, fontWeight: '500', color: colors.neutral900},
  stopPassed: {color: colors.neutral500},
  stopCurrent: {fontWeight: '700', color: colors.green},
  stopLocal: {fontSize: 12, color: colors.neutral500, marginTop: 1},
});
