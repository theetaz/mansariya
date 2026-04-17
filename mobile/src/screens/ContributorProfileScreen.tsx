import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {colors, spacing, radii} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useContributorStore} from '../stores/useContributorStore';
import {fetchContributorProfile} from '../services/contributorApi';
import {clearTokens, getRefreshToken} from '../services/contributorAuth';
import {contributorLogout} from '../services/contributorApi';
import type {RootStackParamList} from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ContributorProfileScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {colors: tc} = useTheme();

  const contributorId = useContributorStore((s) => s.contributorId);
  const displayName = useContributorStore((s) => s.displayName);
  const status = useContributorStore((s) => s.status);
  const stats = useContributorStore((s) => s.stats);
  const setContributor = useContributorStore((s) => s.setContributor);
  const setStats = useContributorStore((s) => s.setStats);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchContributorProfile()
      .then(({contributor, stats: s}) => {
        if (!mounted) return;
        setContributor(contributor);
        setStats(s);
      })
      .catch(() => {
        if (mounted) setError(t('common.error'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const rt = await getRefreshToken();
      if (rt) await contributorLogout(rt);
    } catch {
      // best-effort
    }
    await clearTokens();
    useContributorStore.getState().clear();
    navigation.goBack();
  };

  const statItems = stats
    ? [
        {label: t('contributor.total_trips'), value: String(stats.total_trips)},
        {label: t('contributor.total_pings'), value: String(stats.total_pings)},
        {
          label: t('contributor.total_distance'),
          value: `${stats.total_distance_km.toFixed(1)} km`,
        },
        {
          label: t('contributor.quality_score'),
          value: `${(stats.quality_score * 100).toFixed(0)}%`,
        },
        {label: t('contributor.active_days'), value: String(stats.active_days)},
        {
          label: t('contributor.routes_contributed'),
          value: String(stats.routes_contributed),
        },
      ]
    : [];

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: tc.background}]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: tc.background}]}
      contentContainerStyle={{paddingBottom: insets.bottom + 40}}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, {backgroundColor: colors.greenLight}]}>
          <Text style={styles.avatarText}>
            {(displayName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, {color: tc.text}]}>
          {displayName ?? t('contributor.anonymous')}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                status === 'claimed' ? colors.greenLight : tc.inputBg,
            },
          ]}>
          <Text
            style={[
              styles.statusText,
              {color: status === 'claimed' ? colors.greenDark : tc.textSecondary},
            ]}>
            {status ?? 'anonymous'}
          </Text>
        </View>
      </View>

      {error && (
        <Text style={[styles.errorText, {color: colors.red}]}>{error}</Text>
      )}

      {/* Stats grid */}
      {statItems.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, {color: tc.textSecondary}]}>
            {t('contributor.stats_title', {defaultValue: 'STATS'})}
          </Text>
          <View style={styles.grid}>
            {statItems.map((item) => (
              <View
                key={item.label}
                style={[styles.statCard, {backgroundColor: tc.surface}]}>
                <Text style={[styles.statValue, {color: tc.text}]}>
                  {item.value}
                </Text>
                <Text style={[styles.statLabel, {color: tc.textSecondary}]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Claim CTA for anonymous users */}
      {status === 'anonymous' && (
        <TouchableOpacity
          style={styles.claimButton}
          onPress={() => navigation.navigate('ContributorClaim')}
          activeOpacity={0.7}>
          <Text style={styles.claimButtonText}>
            {t('contributor.claim_cta')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Logout for claimed users */}
      {status === 'claimed' && (
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}>
          <Text style={styles.logoutButtonText}>{t('contributor.logout')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: spacing.lg},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.lg},
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {fontSize: 28, fontWeight: '700', color: colors.greenDark},
  name: {fontSize: 22, fontWeight: '600', marginBottom: spacing.sm},
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  statusText: {fontSize: 13, fontWeight: '500', textTransform: 'capitalize'},
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  statValue: {fontSize: 24, fontWeight: '700', marginBottom: spacing.xs},
  statLabel: {fontSize: 12, fontWeight: '500'},
  errorText: {textAlign: 'center', marginTop: spacing.md, fontSize: 14},
  claimButton: {
    marginTop: spacing.xxl,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  claimButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  logoutButton: {
    marginTop: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  logoutButtonText: {color: colors.red, fontSize: 16, fontWeight: '600'},
});
