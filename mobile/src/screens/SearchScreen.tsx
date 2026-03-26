import React, {useState} from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {colors, spacing, typography, radii} from '../constants/theme';
import {useRouteSearch} from '../hooks/useRouteSearch';
import {Route} from '../services/api';
import RouteCard from '../components/route/RouteCard';

const FILTERS = ['All', 'SLTB', 'NTC', 'Private'] as const;

export default function SearchScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {results, loading, search} = useRouteSearch();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSearch = (text: string) => {
    setQuery(text);
    search(text);
  };

  const filteredResults = activeFilter === 'All'
    ? results
    : results.filter((r) => r.operator === activeFilter);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.neutral500}
            value={query}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.chip,
              activeFilter === filter && styles.chipActive,
            ]}
            onPress={() => setActiveFilter(filter)}>
            <Text
              style={[
                styles.chipText,
                activeFilter === filter && styles.chipTextActive,
              ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading */}
      {loading && <ActivityIndicator style={styles.loader} color={colors.green} />}

      {/* Results */}
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <RouteCard
            routeNumber={item.id}
            destination={item.name_en}
            operator={item.operator}
            serviceType={item.service_type as any}
            isLive={false}
            onPress={() =>
              navigation.navigate('RouteDetail', {routeId: item.id})
            }
          />
        )}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={
          query.length > 0 && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>{t('search.no_results')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  searchBarContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  searchIcon: {fontSize: 16, marginRight: spacing.sm},
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.neutral900,
    paddingVertical: 0,
  },
  clearIcon: {fontSize: 16, color: colors.neutral500, padding: spacing.xs},
  filtersContainer: {
    maxHeight: 44,
    paddingLeft: spacing.lg,
  },
  filtersContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  chipActive: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  chipText: {fontSize: 13, fontWeight: '500', color: colors.neutral500},
  chipTextActive: {color: colors.greenDark},
  loader: {padding: spacing.xl},
  resultsList: {paddingHorizontal: spacing.lg},
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {fontSize: 40, marginBottom: spacing.lg},
  emptyText: {...typography.body, color: colors.neutral500},
});
