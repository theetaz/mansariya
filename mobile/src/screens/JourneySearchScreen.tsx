import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
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
import {searchJourney, searchStops, Stop, JourneyResult} from '../services/api';
import RouteNumberBadge from '../components/common/RouteNumberBadge';
import {useTheme} from '../hooks/useTheme';

export default function JourneySearchScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {colors: tc} = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<Stop | null>(null);
  const [selectedTo, setSelectedTo] = useState<Stop | null>(null);
  const [journeys, setJourneys] = useState<JourneyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleFromChange = useCallback(async (text: string) => {
    setFromText(text);
    setSelectedFrom(null);
    if (text.length >= 2) {
      const stops = await searchStops(text).catch(() => []);
      setFromSuggestions(stops);
      setActiveField('from');
    } else {
      setFromSuggestions([]);
    }
  }, []);

  const handleToChange = useCallback(async (text: string) => {
    setToText(text);
    setSelectedTo(null);
    if (text.length >= 2) {
      const stops = await searchStops(text).catch(() => []);
      setToSuggestions(stops);
      setActiveField('to');
    } else {
      setToSuggestions([]);
    }
  }, []);

  const selectFromStop = (stop: Stop) => {
    setSelectedFrom(stop);
    setFromText(stop.name_en);
    setFromSuggestions([]);
    setActiveField(null);
  };

  const selectToStop = (stop: Stop) => {
    setSelectedTo(stop);
    setToText(stop.name_en);
    setToSuggestions([]);
    setActiveField(null);
  };

  const handleSearch = async () => {
    if (!fromText || !toText) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await searchJourney(fromText, toText);
      setJourneys(result.journeys || []);
    } catch {
      setJourneys([]);
    }
    setLoading(false);
  };

  const suggestions = activeField === 'from' ? fromSuggestions : toSuggestions;

  return (
    <View style={[styles.container, {paddingTop: insets.top, backgroundColor: tc.background}]}>
      {/* Search inputs */}
      <View style={[styles.searchSection, {borderBottomColor: tc.border}]}>
        <Text style={[styles.title, {color: tc.text}]}>Plan your journey</Text>

        <View style={styles.inputRow}>
          <View style={styles.dotGreen} />
          <TextInput
            style={[styles.input, {backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text}]}
            placeholder="From (stop or area)"
            placeholderTextColor={tc.textTertiary}
            value={fromText}
            onChangeText={handleFromChange}
            onFocus={() => setActiveField('from')}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={styles.dotRed} />
          <TextInput
            style={[styles.input, {backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text}]}
            placeholder="To (destination)"
            placeholderTextColor={tc.textTertiary}
            value={toText}
            onChangeText={handleToChange}
            onFocus={() => setActiveField('to')}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.searchButton,
            (!fromText || !toText) && styles.searchButtonDisabled,
          ]}
          onPress={handleSearch}
          disabled={!fromText || !toText || loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Find routes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, {backgroundColor: tc.surface, borderBottomColor: tc.border}]}>
          {suggestions.map((stop) => (
            <TouchableOpacity
              key={stop.id}
              style={[styles.suggestionItem, {borderBottomColor: tc.divider}]}
              onPress={() =>
                activeField === 'from'
                  ? selectFromStop(stop)
                  : selectToStop(stop)
              }>
              <Text style={styles.suggestionIcon}>📍</Text>
              <Text style={[styles.suggestionText, {color: tc.text}]}>{stop.name_en}</Text>
              {stop.name_si ? (
                <Text style={[styles.suggestionLocal, {color: tc.textSecondary}]}>{stop.name_si}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Journey results */}
      <FlatList
        data={journeys}
        keyExtractor={(item, index) => `${item.route.id}-${index}`}
        contentContainerStyle={styles.results}
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.journeyCard, {backgroundColor: tc.surface, borderColor: tc.border}]}
            onPress={() =>
              navigation.navigate('RouteDetail', {routeId: item.route.id})
            }
            activeOpacity={0.7}>
            <View style={styles.journeyHeader}>
              <RouteNumberBadge
                routeNumber={item.route.id}
                serviceType={(item.route.service_type as any) ?? 'Normal'}
              />
              <Text style={[styles.journeyRouteName, {color: tc.text}]}>{item.route.name_en}</Text>
            </View>

            <View style={styles.journeyDetails}>
              <View style={styles.journeyStops}>
                <View style={styles.miniDotGreen} />
                <Text style={[styles.journeyStopName, {color: tc.text}]}>
                  {item.board_stop.stop_name_en}
                </Text>
              </View>
              <Text style={[styles.journeyArrow, {color: tc.textSecondary}]}>↓ {item.stops_between} stops</Text>
              <View style={styles.journeyStops}>
                <View style={styles.miniDotRed} />
                <Text style={[styles.journeyStopName, {color: tc.text}]}>
                  {item.exit_stop.stop_name_en}
                </Text>
              </View>
            </View>

            <View style={styles.journeyMeta}>
              {item.estimated_duration_min > 0 && (
                <Text style={[styles.metaChip, {color: tc.textSecondary, backgroundColor: tc.divider}]}>
                  {item.estimated_duration_min} min
                </Text>
              )}
              {item.fare_lkr > 0 && (
                <Text style={[styles.metaChip, {color: tc.textSecondary, backgroundColor: tc.divider}]}>Rs.{item.fare_lkr}</Text>
              )}
              <Text style={[styles.metaChip, {color: tc.textSecondary, backgroundColor: tc.divider}]}>
                {item.route.operator ?? 'SLTB'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyText, {color: tc.textSecondary}]}>
                No direct routes found between these stops
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral200,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral900,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    marginRight: spacing.md,
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.red,
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.neutral900,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  searchButton: {
    backgroundColor: colors.green,
    borderRadius: radii.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  searchButtonDisabled: {opacity: 0.5},
  searchButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  suggestionsContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral200,
    paddingHorizontal: spacing.lg,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral100,
    gap: spacing.sm,
  },
  suggestionIcon: {fontSize: 14},
  suggestionText: {fontSize: 15, fontWeight: '500', color: colors.neutral900},
  suggestionLocal: {fontSize: 12, color: colors.neutral500},
  results: {paddingHorizontal: spacing.lg, paddingTop: spacing.md},
  journeyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  journeyRouteName: {fontSize: 15, fontWeight: '600', color: colors.neutral900, flex: 1},
  journeyDetails: {marginBottom: spacing.md},
  journeyStops: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  miniDotGreen: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green},
  miniDotRed: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red},
  journeyStopName: {fontSize: 14, color: colors.neutral900},
  journeyArrow: {
    fontSize: 12,
    color: colors.neutral500,
    paddingLeft: 20,
    paddingVertical: 4,
  },
  journeyMeta: {flexDirection: 'row', gap: spacing.sm},
  metaChip: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral500,
    backgroundColor: colors.neutral100,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  emptyState: {paddingVertical: 60, alignItems: 'center'},
  emptyIcon: {fontSize: 40, marginBottom: spacing.md},
  emptyText: {fontSize: 14, color: colors.neutral500, textAlign: 'center'},
});
