import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {colors, spacing, radii} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useContributorStore} from '../stores/useContributorStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {
  fetchContributorProfile,
  fetchLeaderboard,
  type LeaderboardEntry,
} from '../services/contributorApi';
import type {RootStackParamList} from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ContributeScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {colors: tc} = useTheme();

  const isAuthenticated = useContributorStore((s) => s.isAuthenticated);
  const displayName = useContributorStore((s) => s.displayName);
  const status = useContributorStore((s) => s.status);
  const stats = useContributorStore((s) => s.stats);
  const totalTripsLocal = useTrackingStore((s) => s.totalTripsShared);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    // Fetch leaderboard (public, always works)
    try {
      const data = await fetchLeaderboard('total_trips', 5, 0);
      setLeaderboard(data.leaderboard);
    } catch {
      // silently fail
    }

    // Refresh profile if authenticated
    if (isAuthenticated) {
      try {
        const {contributor, stats: s} = await fetchContributorProfile();
        useContributorStore.getState().setContributor(contributor);
        useContributorStore.getState().setStats(s);
      } catch {
        // use cached
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const statCards = [
    {
      label: t('contributor.total_trips'),
      value: stats ? String(stats.total_trips) : String(totalTripsLocal),
    },
    {
      label: t('contributor.total_distance'),
      value: stats ? `${stats.total_distance_km.toFixed(1)} km` : '0 km',
    },
    {
      label: t('contributor.quality_score'),
      value: stats ? `${(stats.quality_score * 100).toFixed(0)}%` : '--',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top, backgroundColor: tc.background}]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.green}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, {backgroundColor: colors.greenLight}]}>
          <Text style={styles.avatarText}>
            {(displayName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          {isAuthenticated && status === 'claimed' ? (
            <Text style={[styles.greeting, {color: tc.text}]}>
              {t('contribute.greeting', {name: displayName, defaultValue: `Hi, ${displayName}!`})}
            </Text>
          ) : (
            <Text style={[styles.greeting, {color: tc.text}]}>
              {t('contribute.start_title', {defaultValue: 'Start contributing'})}
            </Text>
          )}
          <Text style={[styles.subtitle, {color: tc.textSecondary}]}>
            {isAuthenticated
              ? t('contribute.subtitle_active', {defaultValue: 'Your data helps commuters track buses'})
              : t('contribute.subtitle_new', {defaultValue: 'Share your ride to help others'})}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {statCards.map((card) => (
          <View key={card.label} style={[styles.statCard, {backgroundColor: tc.surface}]}>
            <Text style={[styles.statValue, {color: tc.text}]}>{card.value}</Text>
            <Text style={[styles.statLabel, {color: tc.textSecondary}]}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Claim / Login CTA for unauthenticated or anonymous users */}
      {(!isAuthenticated || status === 'anonymous') && (
        <View style={[styles.ctaCard, {backgroundColor: colors.greenLight}]}>
          <Text style={[styles.ctaTitle, {color: colors.greenDark}]}>
            {t('contributor.track_contributions')}
          </Text>
          <Text style={[styles.ctaDesc, {color: colors.greenDark}]}>
            {t('contributor.track_contributions_desc')}
          </Text>
          <View style={styles.ctaButtons}>
            {isAuthenticated && status === 'anonymous' ? (
              <TouchableOpacity
                style={styles.ctaPrimaryBtn}
                onPress={() => navigation.navigate('ContributorClaim')}
                activeOpacity={0.7}>
                <Text style={styles.ctaPrimaryBtnText}>
                  {t('contributor.claim_cta')}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.ctaPrimaryBtn}
                  onPress={() => navigation.navigate('ContributorClaim')}
                  activeOpacity={0.7}>
                  <Text style={styles.ctaPrimaryBtnText}>
                    {t('contributor.claim_cta')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctaSecondaryBtn}
                  onPress={() => navigation.navigate('ContributorLogin')}
                  activeOpacity={0.7}>
                  <Text style={[styles.ctaSecondaryBtnText, {color: colors.greenDark}]}>
                    {t('contributor.login_cta')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Profile link for claimed users */}
      {isAuthenticated && status === 'claimed' && (
        <TouchableOpacity
          style={[styles.profileLink, {backgroundColor: tc.surface}]}
          onPress={() => navigation.navigate('ContributorProfile')}
          activeOpacity={0.7}>
          <Text style={[styles.profileLinkText, {color: tc.text}]}>
            {t('contributor.profile_title')}
          </Text>
          <Text style={[styles.chevron, {color: tc.textTertiary}]}>›</Text>
        </TouchableOpacity>
      )}

      {/* Leaderboard preview */}
      <View style={styles.leaderboardSection}>
        <View style={styles.leaderboardHeader}>
          <Text style={[styles.sectionTitle, {color: tc.text}]}>
            {t('contributor.leaderboard_title')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Leaderboard')}
            activeOpacity={0.7}>
            <Text style={[styles.viewAll, {color: colors.green}]}>
              {t('contribute.view_all', {defaultValue: 'View all'})} ›
            </Text>
          </TouchableOpacity>
        </View>

        {leaderboard.length === 0 ? (
          <Text style={[styles.emptyText, {color: tc.textSecondary}]}>
            {t('contribute.leaderboard_empty', {defaultValue: 'No contributors yet. Be the first!'})}
          </Text>
        ) : (
          leaderboard.map((entry) => {
            const contributorId = useContributorStore.getState().contributorId;
            const isMe = entry.contributor_id === contributorId;
            return (
              <View
                key={entry.contributor_id}
                style={[
                  styles.leaderboardRow,
                  {backgroundColor: isMe ? colors.greenLight : tc.surface},
                ]}>
                <Text
                  style={[
                    styles.rank,
                    {color: isMe ? colors.greenDark : tc.textSecondary},
                  ]}>
                  #{entry.rank}
                </Text>
                <Text
                  style={[styles.entryName, {color: isMe ? colors.greenDark : tc.text}]}
                  numberOfLines={1}>
                  {entry.display_name ?? t('contributor.anonymous')}
                </Text>
                <Text style={[styles.entryTrips, {color: tc.textSecondary}]}>
                  {entry.total_trips} {t('contributor.sort_trips').toLowerCase()}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{height: 120}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: spacing.lg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {fontSize: 22, fontWeight: '700', color: colors.greenDark},
  headerText: {flex: 1},
  greeting: {fontSize: 22, fontWeight: '700'},
  subtitle: {fontSize: 14, marginTop: 2},
  statsRow: {flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl},
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  statValue: {fontSize: 22, fontWeight: '700', marginBottom: 2},
  statLabel: {fontSize: 11, fontWeight: '500'},
  ctaCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  ctaTitle: {fontSize: 16, fontWeight: '600', marginBottom: spacing.xs},
  ctaDesc: {fontSize: 13, lineHeight: 18, marginBottom: spacing.lg, opacity: 0.8},
  ctaButtons: {flexDirection: 'row', gap: spacing.sm},
  ctaPrimaryBtn: {
    flex: 1,
    backgroundColor: colors.green,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  ctaPrimaryBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
  ctaSecondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.greenDark + '40',
  },
  ctaSecondaryBtnText: {fontSize: 14, fontWeight: '600'},
  profileLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.xxl,
  },
  profileLinkText: {fontSize: 16, fontWeight: '500'},
  chevron: {fontSize: 20, fontWeight: '300'},
  leaderboardSection: {marginBottom: spacing.lg},
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {fontSize: 18, fontWeight: '600'},
  viewAll: {fontSize: 14, fontWeight: '500'},
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  rank: {fontSize: 14, fontWeight: '700', width: 36},
  entryName: {flex: 1, fontSize: 15, fontWeight: '500'},
  entryTrips: {fontSize: 13},
  emptyText: {fontSize: 14, textAlign: 'center', paddingVertical: spacing.xxl},
});
