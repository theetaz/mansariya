import React, {useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {colors, spacing, typography} from '../constants/theme';
import {useMapStore} from '../stores/useMapStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {startTracking, stopTracking} from '../services/locationTracker';
import BottomSheet from '../components/common/BottomSheet';
import RouteCard from '../components/route/RouteCard';

const SHEET_COLLAPSED_PX = Dimensions.get('window').height * 0.15;

export default function MapScreen() {
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const buses = useMapStore((s) => s.buses);
  const isTracking = useTrackingStore((s) => s.isTracking);
  const detectedRouteName = useTrackingStore((s) => s.detectedRouteName);

  const handleTrackingToggle = useCallback(() => {
    if (isTracking) {
      stopTracking();
      useTrackingStore.getState().stopTracking();
    } else {
      startTracking();
      useTrackingStore.getState().startTracking();
    }
  }, [isTracking]);

  const busEntries = Object.values(buses);

  return (
    <View style={styles.container}>
      {/* Map area — MapLibre will replace this placeholder */}
      <View style={styles.mapArea}>
        {busEntries.length > 0 && (
          <View style={styles.busCountPill}>
            <Text style={styles.busCountText}>
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

      {/* Bottom sheet — nearby buses */}
      <BottomSheet>
        <Text style={styles.sheetTitle}>{t('map.nearby_routes')}</Text>
        <FlatList
          data={busEntries.slice(0, 10)}
          keyExtractor={(item) => item.virtual_id}
          renderItem={({item}) => (
            <RouteCard
              routeNumber={item.route_id}
              destination={`Route ${item.route_id}`}
              isLive
              onPress={() =>
                navigation.navigate('RouteDetail', {routeId: item.route_id})
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptySheet}>
              <Text style={styles.emptyText}>{t('map.no_buses')}</Text>
            </View>
          }
          scrollEnabled={false}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.surface},
  mapArea: {
    flex: 1,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  busCountPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  busCountText: {fontSize: 13, fontWeight: '500', color: colors.green},
  trackingBanner: {
    position: 'absolute',
    top: 50,
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
    bottom: SHEET_COLLAPSED_PX + spacing.lg,
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
  emptySheet: {paddingVertical: spacing.xxl, alignItems: 'center'},
  emptyText: {...typography.body, color: colors.neutral500},
});
