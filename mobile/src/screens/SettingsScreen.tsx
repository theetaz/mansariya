import React from 'react';
import {View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography} from '../constants/theme';
import {useSettingsStore} from '../stores/useSettingsStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import i18n from '../i18n';

const LANGUAGES: {code: 'si' | 'ta' | 'en'; label: string}[] = [
  {code: 'si', label: 'සිංහල'},
  {code: 'ta', label: 'தமிழ்'},
  {code: 'en', label: 'English'},
];

export default function SettingsScreen() {
  const {t} = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const trackingConsent = useSettingsStore((s) => s.trackingConsent);
  const setTrackingConsent = useSettingsStore((s) => s.setTrackingConsent);
  const totalTrips = useTrackingStore((s) => s.totalTripsShared);

  const handleLanguageChange = (code: 'si' | 'ta' | 'en') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  const currentLangLabel =
    LANGUAGES.find((l) => l.code === language)?.label ?? 'English';

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>{t('settings.title')}</Text>

      {/* GENERAL */}
      <Text style={styles.sectionHeader}>GENERAL</Text>

      <TouchableOpacity style={styles.row}>
        <Text style={styles.rowLabel}>{t('settings.language')}</Text>
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>{currentLangLabel}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Language quick-select (inline for now) */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.langChip,
              language === lang.code && styles.langChipActive,
            ]}
            onPress={() => handleLanguageChange(lang.code)}>
            <Text
              style={[
                styles.langChipText,
                language === lang.code && styles.langChipTextActive,
              ]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* DATA */}
      <Text style={styles.sectionHeader}>DATA</Text>

      <View style={styles.row}>
        <View style={styles.rowLabelContainer}>
          <Text style={styles.rowLabel}>Low data mode</Text>
        </View>
        <Switch
          value={false}
          trackColor={{true: colors.green, false: colors.neutral300}}
          thumbColor={colors.background}
        />
      </View>
      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.rowLabelContainer}>
          <Text style={styles.rowLabel}>Share trip data</Text>
        </View>
        <Switch
          value={trackingConsent}
          onValueChange={setTrackingConsent}
          trackColor={{true: colors.green, false: colors.neutral300}}
          thumbColor={colors.background}
        />
      </View>

      {/* TRACKING */}
      <Text style={styles.sectionHeader}>TRACKING</Text>

      <View style={styles.row}>
        <View style={styles.rowLabelContainer}>
          <Text style={styles.rowLabel}>Auto-detect bus stops</Text>
        </View>
        <Switch
          value={true}
          trackColor={{true: colors.green, false: colors.neutral300}}
          thumbColor={colors.background}
        />
      </View>
      <View style={styles.divider} />

      <TouchableOpacity style={styles.row}>
        <Text style={styles.rowLabel}>Background tracking</Text>
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>Only when active</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      {/* ABOUT */}
      <Text style={styles.sectionHeader}>ABOUT</Text>

      {totalTrips > 0 && (
        <>
          <View style={styles.statsCard}>
            <Text style={styles.statsNumber}>{totalTrips}</Text>
            <Text style={styles.statsLabel}>
              {t('settings.trips_shared', {count: totalTrips})}
            </Text>
          </View>
          <View style={styles.divider} />
        </>
      )}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Version</Text>
        <Text style={styles.rowValue}>1.0.0</Text>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg},
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral900,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral500,
    letterSpacing: 0.5,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLabelContainer: {flex: 1, marginRight: spacing.md},
  rowLabel: {fontSize: 16, fontWeight: '400', color: colors.neutral900},
  rowRight: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  rowValue: {fontSize: 15, color: colors.neutral500},
  chevron: {fontSize: 20, color: colors.neutral300, fontWeight: '300'},
  divider: {height: 0.5, backgroundColor: colors.neutral200},
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  langChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    alignItems: 'center',
  },
  langChipActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  langChipText: {fontSize: 15, fontWeight: '500', color: colors.neutral500},
  langChipTextActive: {color: colors.greenDark},
  statsCard: {
    backgroundColor: colors.greenLight,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  statsNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.green,
  },
  statsLabel: {
    fontSize: 13,
    color: colors.greenDark,
    marginTop: spacing.xs,
  },
});
