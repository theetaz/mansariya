import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';
import {fetchRouteDetail, Route, Stop} from '../services/api';
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
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllStops, setShowAllStops] = useState(false);

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
      const data = await fetchRouteDetail(routeId);
      setRouteData(data.route);
      setStops(data.stops || []);
    } catch {
      // offline fallback would go here
    } finally {
      setLoading(false);
    }
  };

  const toggleSaved = () => {
    if (!routeData) return;
    isSaved ? removeRoute(routeId) : addRoute(routeData);
  };

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

  const displayedStops = showAllStops ? stops : stops.slice(0, 5);
  const hasMore = stops.length > 5 && !showAllStops;

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
        {routeData.frequency_minutes && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>~{routeData.frequency_minutes}</Text>
            <Text style={styles.statLabel}>min freq</Text>
          </View>
        )}
        {routeData.fare_lkr && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>Rs.{routeData.fare_lkr}</Text>
            <Text style={styles.statLabel}>{t('route.fare')}</Text>
          </View>
        )}
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stops.length}</Text>
          <Text style={styles.statLabel}>{t('route.stops')}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Button
          title={t('route.track')}
          onPress={() => {}}
          style={{flex: 1}}
        />
        <Button
          title={isSaved ? 'Saved' : 'Save'}
          onPress={toggleSaved}
          variant="secondary"
          style={{flex: 1}}
        />
      </View>

      {/* Live buses */}
      {activeBuses.length > 0 && (
        <View style={styles.liveBusSection}>
          <Text style={styles.sectionTitle}>
            {activeBuses.length} bus{activeBuses.length > 1 ? 'es' : ''} active
          </Text>
          {activeBuses.map((bus) => (
            <View key={bus.virtual_id} style={styles.busCard}>
              <View style={styles.busInfo}>
                <Text style={styles.busPosition}>
                  ({bus.lat.toFixed(4)}, {bus.lng.toFixed(4)})
                </Text>
                <Text style={styles.busSpeed}>
                  {bus.speed_kmh.toFixed(0)} km/h
                </Text>
              </View>
              <ConfidenceDots level={bus.confidence} />
            </View>
          ))}
        </View>
      )}

      {/* Stop timeline */}
      <Text style={styles.sectionTitle}>
        {t('route.stops')} ({stops.length})
      </Text>
      {displayedStops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1 && showAllStops;
        return (
          <View key={stop.id} style={styles.stopRow}>
            <View style={styles.timeline}>
              <View
                style={[
                  styles.dot,
                  isFirst && styles.dotFirst,
                  isLast && styles.dotLast,
                ]}
              />
              {index < displayedStops.length - 1 && (
                <View style={styles.line} />
              )}
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{stop.name_en}</Text>
              {stop.name_si && (
                <Text style={styles.stopNameLocal}>{stop.name_si}</Text>
              )}
            </View>
          </View>
        );
      })}

      {hasMore && (
        <TouchableOpacity
          style={styles.showMore}
          onPress={() => setShowAllStops(true)}>
          <Text style={styles.showMoreText}>
            Show all {stops.length} stops
          </Text>
        </TouchableOpacity>
      )}

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg},
  errorText: {...typography.body, color: colors.neutral500},
  header: {
    flexDirection: 'row',
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral200,
  },
  headerInfo: {flex: 1, marginLeft: spacing.md},
  routeName: {fontSize: 18, fontWeight: '700', color: colors.neutral900},
  routeNameLocal: {fontSize: 14, color: colors.neutral500, marginTop: 2},
  meta: {fontSize: 12, color: colors.neutral500, marginTop: 4},
  saveBtn: {padding: spacing.sm},
  saveIcon: {fontSize: 28, color: colors.amber},
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {fontSize: 18, fontWeight: '700', color: colors.neutral900},
  statLabel: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  liveBusSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral500,
    letterSpacing: 0.3,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textTransform: 'uppercase',
  },
  busCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.greenLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  busInfo: {},
  busPosition: {fontSize: 13, color: colors.neutral900, fontWeight: '500'},
  busSpeed: {fontSize: 11, color: colors.neutral500, marginTop: 2},
  stopRow: {flexDirection: 'row', paddingHorizontal: spacing.lg},
  timeline: {width: 24, alignItems: 'center'},
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.blue,
    marginTop: 4,
  },
  dotFirst: {backgroundColor: colors.green},
  dotLast: {backgroundColor: colors.red},
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.neutral200,
    marginVertical: 2,
    minHeight: 20,
  },
  stopInfo: {flex: 1, paddingBottom: spacing.lg, paddingLeft: spacing.sm},
  stopName: {fontSize: 15, fontWeight: '500', color: colors.neutral900},
  stopNameLocal: {fontSize: 12, color: colors.neutral500, marginTop: 1},
  showMore: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.green,
  },
});
