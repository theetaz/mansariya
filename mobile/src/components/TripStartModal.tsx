import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {colors, spacing, radii} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {searchRoutesOffline} from '../services/offlineDb';

const CROWD_LEVELS = [
  {value: 1, emoji: '🟢', label: 'Not crowded'},
  {value: 2, emoji: '🟡', label: 'Moderate'},
  {value: 3, emoji: '🟠', label: 'Crowded'},
  {value: 4, emoji: '🔴', label: 'Super crowded'},
];

interface Props {
  visible: boolean;
  onStart: (meta: {routeId?: string; busNumber?: string; crowdLevel?: number}) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function TripStartModal({visible, onStart, onSkip, onCancel}: Props) {
  const {isDark, colors: tc} = useTheme();
  const [routeSearch, setRouteSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<{id: string; name: string} | null>(null);
  const [busNumber, setBusNumber] = useState('');
  const [crowdLevel, setCrowdLevel] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleRouteSearch = useCallback(async (query: string) => {
    setRouteSearch(query);
    setSelectedRoute(null);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
    const results = await searchRoutesOffline(query, 8);
    setSearchResults(results);
  }, []);

  const handleSelectRoute = useCallback((route: any) => {
    setSelectedRoute({id: route.id, name: route.name_en});
    setRouteSearch(`${route.id} — ${route.name_en}`);
    setSearchResults([]);
  }, []);

  const handleStart = useCallback(() => {
    onStart({
      routeId: selectedRoute?.id,
      busNumber: busNumber.trim() || undefined,
      crowdLevel: crowdLevel ?? undefined,
    });
    setRouteSearch('');
    setSelectedRoute(null);
    setBusNumber('');
    setCrowdLevel(null);
  }, [selectedRoute, busNumber, crowdLevel, onStart]);

  const handleSkip = useCallback(() => {
    setRouteSearch('');
    setSelectedRoute(null);
    setBusNumber('');
    setCrowdLevel(null);
    onSkip();
  }, [onSkip]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onCancel} activeOpacity={1} />
        <View style={[styles.sheet, {backgroundColor: tc.card}]}>
          <View style={[styles.handle, {backgroundColor: tc.border}]} />

          <Text style={[styles.title, {color: tc.text}]}>Share your trip</Text>
          <Text style={[styles.subtitle, {color: tc.textSecondary}]}>
            Help other commuters — all fields are optional
          </Text>

          <Text style={[styles.label, {color: tc.textSecondary}]}>Route</Text>
          <TextInput
            style={[styles.input, {backgroundColor: tc.inputBg, color: tc.text, borderColor: tc.border}]}
            placeholder="Search route number..."
            placeholderTextColor={tc.textTertiary}
            value={routeSearch}
            onChangeText={handleRouteSearch}
          />
          {searchResults.length > 0 && (
            <View style={[styles.dropdown, {backgroundColor: tc.surface, borderColor: tc.border}]}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{maxHeight: 120}}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[styles.dropdownItem, {borderBottomColor: tc.divider}]}
                    onPress={() => handleSelectRoute(item)}>
                    <Text style={[styles.dropdownId, {color: tc.text}]}>{item.id}</Text>
                    <Text style={[styles.dropdownName, {color: tc.textSecondary}]} numberOfLines={1}>
                      {item.name_en}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <Text style={[styles.label, {color: tc.textSecondary}]}>Bus number</Text>
          <TextInput
            style={[styles.input, {backgroundColor: tc.inputBg, color: tc.text, borderColor: tc.border}]}
            placeholder="License plate e.g. NB-1234"
            placeholderTextColor={tc.textTertiary}
            value={busNumber}
            onChangeText={setBusNumber}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, {color: tc.textSecondary}]}>How crowded?</Text>
          <View style={styles.crowdRow}>
            {CROWD_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.crowdCard,
                  {backgroundColor: tc.inputBg, borderColor: tc.border},
                  crowdLevel === level.value && {borderColor: colors.green, backgroundColor: colors.greenLight},
                ]}
                onPress={() => setCrowdLevel(crowdLevel === level.value ? null : level.value)}>
                <Text style={styles.crowdEmoji}>{level.emoji}</Text>
                <Text style={[
                  styles.crowdLabel,
                  {color: tc.textSecondary},
                  crowdLevel === level.value && {color: colors.greenDark},
                ]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start Sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipButtonText, {color: tc.textSecondary}]}>Skip & Share</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {flex: 1},
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: 34,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {fontSize: 20, fontWeight: '700', marginBottom: 4},
  subtitle: {fontSize: 13, marginBottom: spacing.lg},
  label: {fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: spacing.md},
  input: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  dropdownId: {fontWeight: '600', fontSize: 14, minWidth: 40},
  dropdownName: {fontSize: 13, flex: 1},
  crowdRow: {flexDirection: 'row', gap: spacing.sm, marginTop: 4},
  crowdCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  crowdEmoji: {fontSize: 20, marginBottom: 4},
  crowdLabel: {fontSize: 10, fontWeight: '500', textAlign: 'center'},
  startButton: {
    backgroundColor: colors.green,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  startButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  skipButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  skipButtonText: {fontSize: 14, fontWeight: '500'},
});
