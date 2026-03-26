import React from 'react';
import {View, Text, StyleSheet, Share} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography, radii} from '../constants/theme';
import Button from '../components/common/Button';
import RouteNumberBadge from '../components/common/RouteNumberBadge';
import {useTrackingStore} from '../stores/useTrackingStore';

interface TripCompleteScreenProps {
  routeId: string;
  routeName: string;
  durationMinutes: number;
  distanceKm: number;
  helpedCount: number;
  onDone: () => void;
}

export default function TripCompleteScreen({
  routeId,
  routeName,
  durationMinutes,
  distanceKm,
  helpedCount,
  onDone,
}: TripCompleteScreenProps) {
  const {t} = useTranslation();
  const totalTrips = useTrackingStore((s) => s.totalTripsShared);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just tracked Route ${routeId} (${routeName}) on Mansariya! Real-time bus tracking for Sri Lanka. Download: https://masariya.lk`,
      });
    } catch {}
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return (
    <View style={styles.container}>
      {/* Checkmark */}
      <View style={styles.checkCircle}>
        <Text style={styles.checkIcon}>✓</Text>
      </View>

      <Text style={styles.title}>
        {t('tracking.trip_complete', 'Trip complete!')}
      </Text>

      <Text style={styles.subtitle}>
        {t('tracking.helped', {count: helpedCount})}
      </Text>

      {/* Trip stats */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <RouteNumberBadge routeNumber={routeId} size="small" />
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{formatDuration(durationMinutes)}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{distanceKm.toFixed(1)} km</Text>
        </View>
      </View>

      {/* Lifetime contribution */}
      <View style={styles.lifetimeCard}>
        <Text style={styles.lifetimeNumber}>{totalTrips}</Text>
        <Text style={styles.lifetimeLabel}>
          {t('settings.trips_shared', {count: totalTrips})}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.buttons}>
        <Button
          title="Share to WhatsApp"
          onPress={handleShare}
          style={styles.shareButton}
        />
        <Button
          title="Done"
          onPress={onDone}
          variant="secondary"
          style={styles.doneButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  checkIcon: {
    fontSize: 36,
    color: colors.green,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.neutral900,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral500,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  statPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral500,
  },
  lifetimeCard: {
    backgroundColor: colors.greenLight,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    width: '100%',
  },
  lifetimeNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.green,
  },
  lifetimeLabel: {
    fontSize: 14,
    color: colors.greenDark,
    marginTop: spacing.xs,
  },
  buttons: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareButton: {flex: 1},
  doneButton: {flex: 1},
});
