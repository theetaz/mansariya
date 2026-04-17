import React, {useCallback, useEffect, useState} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import type {RootStackParamList} from '../navigation/types';
import {palette, radii, spacing, typography} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useContributorStore} from '../stores/useContributorStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {
  fetchContributorProfile,
  fetchLeaderboard,
  type LeaderboardEntry,
} from '../services/contributorApi';
import Glass from '../components/common/Glass';
import Button from '../components/common/Button';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Contribute hub — design handoff screen 16.
 *
 * Large title, hero glass card with weekly-impact headline + bar chart,
 * 3-card stats grid, achievements carousel, and leaderboard preview.
 * Shows claim/login CTAs only while the contributor is still anonymous.
 */
export default function ContributeScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {surface} = useTheme();

  const isAuthenticated = useContributorStore((s) => s.isAuthenticated);
  const displayName = useContributorStore((s) => s.displayName);
  const status = useContributorStore((s) => s.status);
  const stats = useContributorStore((s) => s.stats);
  const totalTripsLocal = useTrackingStore((s) => s.totalTripsShared);
  const contributorId = useContributorStore((s) => s.contributorId);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchLeaderboard('total_trips', 5, 0);
      setLeaderboard(data.leaderboard);
    } catch {}
    if (isAuthenticated) {
      try {
        const {contributor, stats: s} = await fetchContributorProfile();
        useContributorStore.getState().setContributor(contributor);
        useContributorStore.getState().setStats(s);
      } catch {}
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

  const tripsValue = stats?.total_trips ?? totalTripsLocal;
  const kmValue = stats?.total_distance_km ?? 0;
  const qualityValue = stats ? `${(stats.quality_score * 100).toFixed(0)}%` : '—';

  const showClaimCTA = !isAuthenticated || status === 'anonymous';

  // Weekly bars — use placeholder pattern; backend weekly series can fill later.
  const weekBars = [18, 24, 14, 22, 28, 16, 20];
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  return (
    <View style={[styles.root, {backgroundColor: surface.bg}]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.emerald}
          />
        }>
        {/* Large title */}
        <View style={styles.header}>
          <Text style={[styles.title, {color: surface.text}]}>
            {t('contribute.title', 'Contribute')}
          </Text>
          <View
            style={[
              styles.bellBtn,
              {backgroundColor: surface.card, borderColor: surface.hairline},
            ]}>
            <Ionicons
              name="notifications-outline"
              size={18}
              color={surface.textDim}
            />
          </View>
        </View>

        {/* Hero — weekly impact glass card */}
        <View style={styles.block}>
          <Glass radius={radii.xxl} intensity={60}>
            <View style={styles.hero}>
              {/* Amber radial glow corner */}
              <View
                pointerEvents="none"
                style={styles.heroGlow}
              />

              <Text style={[styles.eyebrow, {color: surface.textDim}]}>
                {t('contribute.weekly_impact', 'WEEKLY IMPACT')}
              </Text>
              <View style={styles.heroFigureRow}>
                <Text style={[styles.heroNumber, {color: surface.text}]}>
                  {tripsValue > 0 ? tripsValue * 4 : 0}
                </Text>
                <Text style={[styles.heroUnit, {color: surface.textDim}]}>
                  {t('contribute.commuters_helped', 'commuters helped')}
                </Text>
              </View>

              <View style={styles.barsRow}>
                {weekBars.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: h,
                      marginHorizontal: 2,
                      borderRadius: 4,
                      backgroundColor:
                        i === todayIndex ? palette.amber : palette.green,
                      opacity: i === todayIndex ? 1 : 0.6,
                    }}
                  />
                ))}
              </View>
              <View style={styles.daysRow}>
                {WEEK.map((d, i) => (
                  <Text
                    key={i}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 10,
                      color:
                        i === todayIndex ? palette.amber : surface.textDim,
                      fontWeight: i === todayIndex ? '700' : '500',
                    }}>
                    {d}
                  </Text>
                ))}
              </View>
            </View>
          </Glass>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            {
              icon: 'bus' as const,
              v: String(tripsValue),
              l: t('contributor.total_trips', 'Trips'),
            },
            {
              icon: 'trail-sign' as const,
              v: `${kmValue.toFixed(1)} km`,
              l: t('contributor.total_distance', 'Distance'),
            },
            {
              icon: 'sparkles' as const,
              v: qualityValue,
              l: t('contributor.quality_score', 'Quality'),
            },
          ].map((s, i) => (
            <View
              key={s.l}
              style={{
                flex: 1,
                marginLeft: i === 0 ? 0 : 8,
                padding: 14,
                borderRadius: radii.lg,
                backgroundColor: surface.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: surface.hairline,
              }}>
              <Ionicons name={s.icon} size={16} color={palette.green} />
              <Text
                style={[
                  styles.statValue,
                  {color: surface.text, marginTop: 6},
                ]}>
                {s.v}
              </Text>
              <Text style={[styles.statLabel, {color: surface.textDim}]}>
                {s.l}
              </Text>
            </View>
          ))}
        </View>

        {/* Claim / Login CTA if anonymous */}
        {showClaimCTA ? (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.xl,
              backgroundColor: palette.greenSoft,
            }}>
            <Text style={[styles.ctaTitle, {color: palette.emerald}]}>
              {t('contributor.track_contributions', 'Track your contributions')}
            </Text>
            <Text style={[styles.ctaDesc, {color: palette.emerald}]}>
              {t(
                'contributor.track_contributions_desc',
                'Claim a profile or log in to keep your stats on the leaderboard.',
              )}
            </Text>
            <View style={styles.ctaRow}>
              <View style={{flex: 1}}>
                <Button
                  title={t('contributor.claim_cta', 'Claim your profile')}
                  onPress={() => navigation.navigate('ContributorClaim')}
                />
              </View>
              {!(isAuthenticated && status === 'anonymous') ? (
                <View style={{flex: 1, marginLeft: spacing.sm}}>
                  <Button
                    title={t('contributor.login_cta', 'Log in')}
                    onPress={() => navigation.navigate('ContributorLogin')}
                    variant="secondary"
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Profile link if claimed */}
        {isAuthenticated && status === 'claimed' ? (
          <Pressable
            onPress={() => navigation.navigate('ContributorProfile')}
            style={({pressed}) => ({
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: radii.xl,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: surface.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: surface.hairline,
              transform: [{scale: pressed ? 0.99 : 1}],
            })}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.greenSoft,
                marginRight: spacing.md,
              }}>
              <Text style={{fontSize: 16, fontWeight: '700', color: palette.emerald}}>
                {(displayName ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={{fontSize: 15, fontWeight: '600', color: surface.text}}>
                {displayName ?? t('contributor.profile_title', 'Profile')}
              </Text>
              <Text style={{fontSize: 12, color: surface.textDim, marginTop: 2}}>
                {t('contribute.view_profile', 'View stats & achievements')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={surface.textSoft}
            />
          </Pressable>
        ) : null}

        {/* Leaderboard preview */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, {color: surface.text}]}>
            {t('contributor.leaderboard_title', 'Leaderboard')}
          </Text>
          <Pressable onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={styles.viewAll}>
              {t('contribute.view_all', 'View all')} ›
            </Text>
          </Pressable>
        </View>

        <View style={{marginHorizontal: spacing.lg}}>
          <Glass radius={radii.lg} intensity={50}>
            <View style={{paddingHorizontal: 14, paddingVertical: 2}}>
              {leaderboard.length === 0 ? (
                <Text
                  style={{
                    paddingVertical: spacing.xl,
                    textAlign: 'center',
                    fontSize: 13,
                    color: surface.textDim,
                  }}>
                  {t(
                    'contribute.leaderboard_empty',
                    'No contributors yet. Be the first!',
                  )}
                </Text>
              ) : (
                leaderboard.map((entry, i) => {
                  const isMe = entry.contributor_id === contributorId;
                  const medal =
                    entry.rank === 1
                      ? '🥇'
                      : entry.rank === 2
                        ? '🥈'
                        : entry.rank === 3
                          ? '🥉'
                          : `#${entry.rank}`;
                  return (
                    <View
                      key={entry.contributor_id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        borderTopWidth:
                          i > 0 ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: surface.hairline,
                      }}>
                      <Text
                        style={{
                          width: 30,
                          textAlign: 'center',
                          fontSize: 13,
                          fontWeight: '700',
                          color: isMe ? palette.emerald : surface.textDim,
                        }}>
                        {medal}
                      </Text>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginHorizontal: 10,
                          backgroundColor: isMe
                            ? palette.emerald
                            : surface.bgAlt,
                        }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: isMe ? '#FFFFFF' : surface.text,
                          }}>
                          {(entry.display_name ?? '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: isMe ? '700' : '600',
                          color: isMe ? palette.emerald : surface.text,
                        }}
                        numberOfLines={1}>
                        {entry.display_name ??
                          t('contributor.anonymous', 'Anonymous')}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: surface.textDim,
                          fontWeight: '500',
                        }}>
                        {entry.total_trips} trips
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </Glass>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 34,
    flex: 1,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  block: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  hero: {
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(232,154,60,0.25)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroFigureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  heroNumber: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginRight: 8,
  },
  heroUnit: {
    fontSize: 14,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 14,
    height: 32,
    paddingHorizontal: 2,
  },
  daysRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctaDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: spacing.md,
    opacity: 0.85,
  },
  ctaRow: {
    flexDirection: 'row',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.green,
  },
});
