import React from 'react';
import {View, Text, TouchableOpacity, Switch, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSettingsStore} from '../stores/useSettingsStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import i18n from '../i18n';

const LANGUAGES = [
  {code: 'si' as const, label: 'සිංහල', labelEn: 'Sinhala'},
  {code: 'ta' as const, label: 'தமிழ்', labelEn: 'Tamil'},
  {code: 'en' as const, label: 'English', labelEn: 'English'},
];

export default function SettingsScreen() {
  const {t} = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const trackingConsent = useSettingsStore((s) => s.trackingConsent);
  const setTrackingConsent = useSettingsStore((s) => s.setTrackingConsent);
  const totalTrips = useTrackingStore((s) => s.totalTripsShared);

  const handleLanguageChange = (code: 'en' | 'si' | 'ta') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <View style={styles.container}>
      {/* Language */}
      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.languageRow}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.langButton,
              language === lang.code && styles.langButtonActive,
            ]}
            onPress={() => handleLanguageChange(lang.code)}>
            <Text
              style={[
                styles.langLabel,
                language === lang.code && styles.langLabelActive,
              ]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tracking */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.tracking')}</Text>
          <Text style={styles.settingDesc}>{t('settings.tracking_desc')}</Text>
        </View>
        <Switch value={trackingConsent} onValueChange={setTrackingConsent} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {t('settings.trips_shared', {count: totalTrips})}
        </Text>
      </View>

      {/* About */}
      <TouchableOpacity style={styles.settingRow}>
        <Text style={styles.settingTitle}>{t('settings.about')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff', padding: 16},
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  languageRow: {flexDirection: 'row', gap: 8, marginBottom: 24},
  langButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  langButtonActive: {borderColor: '#2563EB', backgroundColor: '#EFF6FF'},
  langLabel: {fontSize: 18, fontWeight: '600', color: '#666'},
  langLabelActive: {color: '#2563EB'},
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {flex: 1, marginRight: 16},
  settingTitle: {fontSize: 16, fontWeight: '600', color: '#333'},
  settingDesc: {fontSize: 13, color: '#999', marginTop: 2},
  statsRow: {paddingVertical: 20, alignItems: 'center'},
  statsText: {fontSize: 16, color: '#16A34A', fontWeight: '600'},
});
