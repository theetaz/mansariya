import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';
import {fetchRouteDetail, fetchRouteStops, Route, EnrichedRouteStop} from '../services/api';
import {useSavedStore} from '../stores/useSavedStore';
import {useBusPositions} from '../hooks/useBusPositions';
import {useMapStore} from '../stores/useMapStore';
import {colors, spacing, typography, radii} from '../constants/theme';
import RouteNumberBadge from '../components/common/RouteNumberBadge';
import ConfidenceDots from '../components/common/ConfidenceDots';
import Button from '../components/common/Button';

export default function RouteDetailScreen() {
  const {t} = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetail'>>();
  const {routeId} = route.params;

  const [routeData, setRouteData] = useState<Route | null>(null);
  const [stops, setStops] = useState<EnrichedRouteStop[]>([]);
  const [loading, setLoading] = useState(true);

  const addRoute = useSavedStore((s) => s.addRoute);
  const removeRoute = useSavedStore((s) => s.removeRoute);
  const isSaved = useSavedStore((s) => s.isSaved(routeId));
  const buses = useMapStore((s) => s.buses);

  useBusPositions(routeId);

  const activeBuses = Object.values(buses).filter(
    (b) => b.route_id === routeId,
  );

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

  // Find which stop the bus is nearest to
  const getBusStopIndex = (busLat: number, busLng: number): number => {
    if (stops.length === 0) return -1;
    let minDist = Infinity;
    let bestIdx = 0;
    stops.forEach((s, i) => {
      const dist = Math.sqrt(
        Math.pow(s.stop_lat - busLat, 2) + Math.pow(s.stop_lng - busLng, 2),
      );
      if (dist < minDist) {
        minDist = dist;
        bestIdx = i;
      }
    });
    return bestIdx;
  };

  const leadBus = activeBuses[0];
  const busAtStopIdx = leadBus ? getBusStopIndex(leadBus.lat, leadBus.lng) : -1;

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
    <ScrollView style={styles.container}>
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
          {routeData.operator && (
            <Text style={styles.meta}>
              {routeData.operator}
              {routeData.service_type ? ` · ${routeData.service_type}` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={toggleSaved} style={styles.saveBtn}>
          <Text style={styles.saveIcon}>{isSaved ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.statLabel}>{t('route.fare')}</Text>
          </View>
        ) : null}
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stops.length}</Text>
          <Text style={styles.statLabel}>{t('route.stops')}</Text>
        </View>
      </View>

      {/* Live buses */}
      {activeBuses.length > 0 && (
        <View style={styles.liveBusSection}>
          <Text style={styles.sectionTitle}>
            {activeBuses.length} bus{activeBuses.length > 1 ? 'es' : ''} active
          </Text>
          {activeBuses.map((bus) => (
            <View key={bus.virtual_id} style={styles.busCard}>
              <View>
                <Text style={styles.busSpeed}>{bus.speed_kmh.toFixed(0)} km/h</Text>
                <Text style={styles.busContrib}>
                  {bus.contributor_count} contributor{bus.contributor_count > 1 ? 's' : ''}
                </Text>
              </View>
              <ConfidenceDots level={bus.confidence} />
            </View>
          ))}
        </View>
      )}

      {/* Stop timeline with live trip progress */}
      <Text style={styles.sectionTitle}>{t('route.stops')} ({stops.length})</Text>

      {stops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        const isPassed = busAtStopIdx >= 0 && index < busAtStopIdx;
        const isCurrent = index === busAtStopIdx;

        return (
          <View key={stop.stop_id} style={styles.stopRow}>
            <View style={styles.timeline}>
              <View
                style={[
                  styles.dot,
                  isFirst && styles.dotOrigin,
                  isLast && styles.dotDest,
                  isPassed && styles.dotPassed,
                  isCurrent && styles.dotCurrent,
                ]}
              />
              {!isLast && (
                <View style={[styles.line, isPassed && styles.linePassed]} />
              )}
              {isCurrent && (
                <View style={styles.busIcon}>
                  <Text style={{fontSize: 20}}>🚌</Text>
                </View>
              )}
            </View>

            <View style={styles.stopInfo}>
              <Text
                style={[
                  styles.stopName,
                  isPassed && styles.stopPassed,
                  isCurrent && styles.stopCurrent,
                ]}>
                {stop.stop_name_en}
              </Text>
              {stop.stop_name_si ? (
                <Text style={styles.stopLocal}>{stop.stop_name_si}</Text>
              ) : null}
              <View style={styles.stopMeta}>
                {stop.typical_duration_min > 0 && (
                  <Text style={styles.metaText}>{stop.typical_duration_min} min</Text>
                )}
                {stop.fare_from_start_lkr > 0 && (
                  <Text style={styles.metaText}>Rs.{stop.fare_from_start_lkr}</Text>
                )}
                {stop.is_terminal && (
                  <View style={styles.terminalBadge}>
                    <Text style={styles.terminalText}>Terminal</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}

      <View style={{height: 40}} />
    </ScrollView>
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
  routeNameLocal: {fontSize: 14, color: colors.neutral500, marginTop: 2},
  meta: {fontSize: 12, color: colors.neutral500, marginTop: 4},
  saveBtn: {padding: spacing.sm},
  saveIcon: {fontSize: 28, color: colors.amber},
  statsRow: {flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm},
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md,
    padding: spacing.md, alignItems: 'center',
  },
  statValue: {fontSize: 18, fontWeight: '700', color: colors.neutral900},
  statLabel: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  liveBusSection: {paddingHorizontal: spacing.lg, paddingBottom: spacing.md},
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: colors.neutral500,
    letterSpacing: 0.3, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    textTransform: 'uppercase',
  },
  busCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.greenLight, borderRadius: radii.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  busSpeed: {fontSize: 15, fontWeight: '600', color: colors.neutral900},
  busContrib: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  stopRow: {flexDirection: 'row', paddingHorizontal: spacing.lg},
  timeline: {width: 30, alignItems: 'center'},
  dot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.neutral300, borderWidth: 2, borderColor: colors.neutral200,
    marginTop: 4, zIndex: 2,
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
  stopMeta: {flexDirection: 'row', gap: spacing.sm, marginTop: 4},
  metaText: {fontSize: 11, color: colors.neutral500},
  terminalBadge: {backgroundColor: colors.blueLight, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1},
  terminalText: {fontSize: 10, fontWeight: '600', color: colors.blueDark},
});
