import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, spacing, radii} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useContributorStore} from '../stores/useContributorStore';
import {fetchLeaderboard, type LeaderboardEntry} from '../services/contributorApi';

const PAGE_SIZE = 50;
type SortKey = 'total_trips' | 'total_distance_km' | 'quality_score';

const SORT_OPTIONS: {key: SortKey; labelKey: string}[] = [
  {key: 'total_trips', labelKey: 'contributor.sort_trips'},
  {key: 'total_distance_km', labelKey: 'contributor.sort_distance'},
  {key: 'quality_score', labelKey: 'contributor.sort_score'},
];

export default function LeaderboardScreen() {
  const {t} = useTranslation();
  const {colors: tc} = useTheme();
  const myContributorId = useContributorStore((s) => s.contributorId);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortKey>('total_trips');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (offset = 0, append = false) => {
      try {
        const data = await fetchLeaderboard(sort, PAGE_SIZE, offset);
        setEntries((prev) =>
          append ? [...prev, ...data.leaderboard] : data.leaderboard,
        );
        setTotal(data.total);
      } catch {
        // silently fail
      }
    },
    [sort],
  );

  useEffect(() => {
    setLoading(true);
    load(0).finally(() => setLoading(false));
  }, [load]);

  const handleLoadMore = () => {
    if (loadingMore || entries.length >= total) return;
    setLoadingMore(true);
    load(entries.length, true).finally(() => setLoadingMore(false));
  };

  const renderItem = ({item}: {item: LeaderboardEntry}) => {
    const isMe = item.contributor_id === myContributorId;
    return (
      <View
        style={[
          styles.row,
          {backgroundColor: isMe ? colors.greenLight : tc.surface},
        ]}>
        <Text style={[styles.rank, {color: isMe ? colors.greenDark : tc.textSecondary}]}>
          #{item.rank}
        </Text>
        <View style={styles.rowInfo}>
          <Text
            style={[styles.rowName, {color: isMe ? colors.greenDark : tc.text}]}
            numberOfLines={1}>
            {item.display_name ?? t('contributor.anonymous')}
          </Text>
          <Text style={[styles.rowSub, {color: tc.textSecondary}]}>
            {item.total_trips} {t('contributor.sort_trips').toLowerCase()} &middot;{' '}
            {item.total_distance_km.toFixed(1)} km
          </Text>
        </View>
        <Text style={[styles.rowScore, {color: isMe ? colors.greenDark : colors.green}]}>
          {(item.quality_score * 100).toFixed(0)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: tc.background}]}>
      {/* Sort toggle */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.sortChip,
              {borderColor: tc.border, backgroundColor: tc.surface},
              sort === opt.key && styles.sortChipActive,
            ]}
            onPress={() => setSort(opt.key)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.sortChipText,
                {color: tc.textSecondary},
                sort === opt.key && styles.sortChipTextActive,
              ]}>
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.contributor_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{padding: spacing.lg}}
                color={colors.green}
              />
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, {color: tc.textSecondary}]}>
              {t('contributor.leaderboard_empty', {defaultValue: 'No contributors yet'})}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sortChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sortChipActive: {borderColor: colors.green, backgroundColor: colors.greenLight},
  sortChipText: {fontSize: 14, fontWeight: '500'},
  sortChipTextActive: {color: colors.greenDark},
  list: {paddingHorizontal: spacing.lg, paddingBottom: 40},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  rank: {fontSize: 14, fontWeight: '700', width: 36},
  rowInfo: {flex: 1},
  rowName: {fontSize: 15, fontWeight: '600'},
  rowSub: {fontSize: 12, marginTop: 2},
  rowScore: {fontSize: 16, fontWeight: '700'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  empty: {textAlign: 'center', marginTop: 40, fontSize: 15},
});
