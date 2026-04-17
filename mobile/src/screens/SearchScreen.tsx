import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';

import type {RootStackParamList} from '../navigation/types';
import {palette, radii, spacing, typography} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useRouteSearch} from '../hooks/useRouteSearch';
import Glass from '../components/common/Glass';
import {RouteBadge} from '../components/common/RouteBadge';

const FILTERS = ['All', 'SLTB', 'NTC', 'Private'] as const;

/**
 * Search — design handoff screen 14 (tab variant).
 *
 * Large title header, glass search input, eyebrow sections for "Matching
 * routes" (RouteBadge rows with from→to, type, live count) and "Matching
 * stops" (blue pin tile, name, distance · routes). Empty state surfaces
 * the journey planner as a call to action.
 */
export default function SearchScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {isDark, surface} = useTheme();
  const {results, loading, search} = useRouteSearch();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');

  const handleSearch = (text: string) => {
    setQuery(text);
    search(text);
  };

  const filtered = useMemo(
    () =>
      activeFilter === 'All'
        ? results
        : results.filter((r) => r.operator === activeFilter),
    [activeFilter, results],
  );

  const showResults = query.length > 0;

  return (
    <View style={[styles.root, {backgroundColor: surface.bg}]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + 96,
        }}
        keyboardShouldPersistTaps="handled">
        {/* Large title header */}
        <View style={styles.header}>
          <Text style={[styles.title, {color: surface.text}]}>
            {t('search.title', 'Search')}
          </Text>
        </View>

        {/* Glass search input */}
        <View style={styles.searchWrap}>
          <Glass radius={radii.lg} intensity={50}>
            <View style={styles.searchInner}>
              <Ionicons
                name="search"
                size={18}
                color={surface.textDim}
                style={{marginRight: 10}}
              />
              <TextInput
                value={query}
                onChangeText={handleSearch}
                placeholder={t('search.placeholder', 'Search routes or stops…')}
                placeholderTextColor={surface.textDim}
                style={[styles.searchInput, {color: surface.text}]}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => handleSearch('')}
                  style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                  <Ionicons name="close" size={18} color={surface.textDim} />
                </Pressable>
              ) : null}
            </View>
          </Glass>
        </View>

        {/* Filter chips */}
        <View style={styles.chipsRow}>
          {FILTERS.map((f, i) => {
            const active = activeFilter === f;
            const chipStyle = {
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              marginRight: i < FILTERS.length - 1 ? 8 : 0,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              backgroundColor: active
                ? isDark
                  ? 'rgba(29,158,117,0.18)'
                  : 'rgba(29,158,117,0.10)'
                : surface.card,
              borderColor: active ? palette.green : surface.hairline,
              borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
            };
            return (
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={chipStyle}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? '700' : '500',
                    color: active ? palette.emerald : surface.textDim,
                  }}>
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Journey planner call-out */}
        {!showResults ? (
          <Pressable
            onPress={() => navigation.navigate('JourneySearch')}
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.lg,
              borderRadius: radii.xl,
              borderWidth: StyleSheet.hairlineWidth,
              gap: spacing.md,
              backgroundColor: surface.card,
              borderColor: surface.hairline,
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 6},
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 3,
            }}>
            <View
              style={[
                styles.journeyIcon,
                {backgroundColor: palette.greenSoft},
              ]}>
              <Ionicons name="navigate" size={20} color={palette.emerald} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.journeyTitle, {color: surface.text}]}>
                {t('search.journey_title', 'Plan a journey')}
              </Text>
              <Text style={[styles.journeySub, {color: surface.textDim}]}>
                {t(
                  'search.journey_sub',
                  'From → To with timings and routes.',
                )}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={surface.textSoft}
            />
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.emerald} style={{marginTop: 24}} />
        ) : null}

        {/* Results */}
        {showResults ? (
          <>
            <Text style={[styles.eyebrow, {color: surface.textDim}]}>
              {t('search.matching_routes', 'Matching routes')}
            </Text>

            {filtered.length === 0 && !loading ? (
              <View style={styles.emptyRow}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={surface.textDim}
                />
                <Text style={[styles.emptyText, {color: surface.textDim}]}>
                  {t('search.no_results', 'No routes match')}
                </Text>
              </View>
            ) : (
              filtered.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() =>
                    navigation.navigate('RouteDetail', {routeId: r.id})
                  }
                  style={({pressed}) => [
                    styles.row,
                    {
                      borderTopColor: surface.hairline,
                      borderTopWidth:
                        i > 0 ? StyleSheet.hairlineWidth : 0,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <RouteBadge
                    num={r.id}
                    service={
                      (r.service_type as any) in serviceColorMap
                        ? (r.service_type as keyof typeof serviceColorMap)
                        : 'Normal'
                    }
                    color={
                      serviceColorMap[
                        (r.service_type as keyof typeof serviceColorMap) ??
                          'Normal'
                      ] ?? palette.emerald
                    }
                    size="md"
                  />
                  <View style={{flex: 1, minWidth: 0}}>
                    <Text
                      numberOfLines={1}
                      style={[styles.rowTitle, {color: surface.text}]}>
                      {r.name_en}
                    </Text>
                    <Text
                      style={[styles.rowSub, {color: surface.textDim}]}
                      numberOfLines={1}>
                      {r.service_type ?? 'Normal'}
                      {r.operator ? ` · ${r.operator}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={surface.textSoft}
                  />
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const serviceColorMap = {
  Normal: palette.emerald,
  'Semi Luxury': '#BA7517',
  'AC Luxury': '#185FA5',
} as const;

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 34,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  searchInner: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journey: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  journeyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  journeySub: {
    fontSize: 12,
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    gap: 14,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
  },
});
