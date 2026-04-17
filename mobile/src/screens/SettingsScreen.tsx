import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import {palette, radii, spacing, typography} from '../constants/theme';
import {useSettingsStore, type ThemeMode} from '../stores/useSettingsStore';
import {useTrackingStore} from '../stores/useTrackingStore';
import {useContributorStore} from '../stores/useContributorStore';
import {useTheme} from '../hooks/useTheme';
import i18n from '../i18n';

const LANGUAGES: Array<{code: 'si' | 'ta' | 'en'; label: string; name: string}> = [
  {code: 'si', label: 'සිංහල', name: 'Sinhala'},
  {code: 'ta', label: 'தமிழ்', name: 'Tamil'},
  {code: 'en', label: 'English', name: 'English'},
];

const THEMES: Array<{code: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap}> = [
  {code: 'light', label: 'Light', icon: 'sunny'},
  {code: 'dark', label: 'Dark', icon: 'moon'},
  {code: 'system', label: 'System', icon: 'phone-portrait'},
];

/**
 * Settings — refreshed to match the handoff's grouped-rows pattern.
 *
 * Large title, optional profile glass card (claimed contributor), and
 * rounded grouped cards per section with coloured icon tiles on each row.
 */
export default function SettingsScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {isDark, surface} = useTheme();

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const trackingConsent = useSettingsStore((s) => s.trackingConsent);
  const setTrackingConsent = useSettingsStore((s) => s.setTrackingConsent);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const totalTrips = useTrackingStore((s) => s.totalTripsShared);

  const displayName = useContributorStore((s) => s.displayName);
  const isClaimed = useContributorStore(
    (s) => s.isAuthenticated && s.status === 'claimed',
  );
  const stats = useContributorStore((s) => s.stats);

  const handleLanguage = (code: 'si' | 'ta' | 'en') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <View style={[styles.root, {backgroundColor: surface.bg}]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}>
        <Text style={[styles.title, {color: surface.text}]}>
          {t('settings.title', 'Settings')}
        </Text>

        {/* Profile card (only if claimed) */}
        {isClaimed ? (
          <View style={styles.block}>
            <View
              style={[
                styles.profileCard,
                {
                  backgroundColor: surface.card,
                  borderColor: surface.hairline,
                },
              ]}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {(displayName ?? '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={[styles.profileName, {color: surface.text}]}>
                  {displayName ?? 'You'}
                </Text>
                <Text style={[styles.profileMeta, {color: surface.textDim}]}>
                  {stats?.total_trips ?? 0} trips ·{' '}
                  {(stats?.total_distance_km ?? 0).toFixed(0)} km
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={surface.textSoft}
              />
            </View>
          </View>
        ) : null}

        {/* PREFERENCES */}
        <Text style={[styles.eyebrow, {color: surface.textDim}]}>
          {t('settings.preferences', 'PREFERENCES')}
        </Text>

        <View
          style={[
            styles.card,
            {backgroundColor: surface.card, borderColor: surface.hairline},
          ]}>
          {/* Language row → chip picker beneath */}
          <View style={styles.row}>
            <IconTile color="#378ADD" icon="globe" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.language', 'Language')}
            </Text>
            <Text style={[styles.rowValue, {color: surface.textDim}]}>
              {LANGUAGES.find((l) => l.code === language)?.name ?? 'English'}
            </Text>
          </View>
          <View style={styles.chipRow}>
            {LANGUAGES.map((l, i) => {
              const active = language === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => handleLanguage(l.code)}
                  style={{
                    flex: 1,
                    marginLeft: i === 0 ? 0 : 6,
                    height: 40,
                    borderRadius: radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(29,158,117,0.18)'
                        : 'rgba(29,158,117,0.10)'
                      : surface.bgAlt,
                    borderColor: active ? palette.green : surface.hairline,
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: active ? '700' : '500',
                      color: active ? palette.emerald : surface.textDim,
                    }}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Divider color={surface.hairline} />

          {/* Appearance row → chip picker beneath */}
          <View style={styles.row}>
            <IconTile color={palette.green} icon="leaf" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.appearance', 'Appearance')}
            </Text>
            <Text style={[styles.rowValue, {color: surface.textDim}]}>
              {THEMES.find((th) => th.code === themeMode)?.label ?? 'System'}
            </Text>
          </View>
          <View style={styles.chipRow}>
            {THEMES.map((th, i) => {
              const active = themeMode === th.code;
              return (
                <Pressable
                  key={th.code}
                  onPress={() => setThemeMode(th.code)}
                  style={{
                    flex: 1,
                    marginLeft: i === 0 ? 0 : 6,
                    height: 40,
                    borderRadius: radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(29,158,117,0.18)'
                        : 'rgba(29,158,117,0.10)'
                      : surface.bgAlt,
                    borderColor: active ? palette.green : surface.hairline,
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  }}>
                  <Ionicons
                    name={th.icon}
                    size={14}
                    color={active ? palette.emerald : surface.textDim}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? '700' : '500',
                      color: active ? palette.emerald : surface.textDim,
                    }}>
                    {th.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Divider color={surface.hairline} />

          {/* Share trip data toggle */}
          <View style={styles.row}>
            <IconTile color={palette.amber} icon="radio" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.share_trip_data', 'Share trip data')}
            </Text>
            <Switch
              value={trackingConsent}
              onValueChange={setTrackingConsent}
              trackColor={{true: palette.emerald, false: surface.hairline}}
              thumbColor="#FFFFFF"
            />
          </View>

          <Divider color={surface.hairline} />

          {/* Notifications — placeholder row */}
          <Pressable style={styles.row}>
            <IconTile color={palette.coral} icon="notifications" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.notifications', 'Notifications')}
            </Text>
            <Text style={[styles.rowValue, {color: surface.textDim}]}>—</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={surface.textSoft}
            />
          </Pressable>
        </View>

        {/* TRIPS SHARED (if any) */}
        {totalTrips > 0 ? (
          <>
            <Text style={[styles.eyebrow, {color: surface.textDim}]}>
              {t('settings.your_impact', 'YOUR IMPACT')}
            </Text>
            <View
              style={[
                styles.impactCard,
                {backgroundColor: palette.greenSoft},
              ]}>
              <Text style={styles.impactNumber}>{totalTrips}</Text>
              <Text style={styles.impactLabel}>
                {t('settings.trips_shared', {
                  count: totalTrips,
                  defaultValue:
                    totalTrips === 1 ? 'trip shared' : 'trips shared',
                })}
              </Text>
            </View>
          </>
        ) : null}

        {/* ABOUT */}
        <Text style={[styles.eyebrow, {color: surface.textDim}]}>
          {t('settings.about', 'ABOUT')}
        </Text>
        <View
          style={[
            styles.card,
            {backgroundColor: surface.card, borderColor: surface.hairline},
          ]}>
          <Pressable style={styles.row}>
            <IconTile color={surface.textDim} icon="information-circle" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.about_mansariya', 'About Mansariya')}
            </Text>
            <Text style={[styles.rowValue, {color: surface.textDim}]}>
              v1.0.0
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={surface.textSoft}
            />
          </Pressable>

          <Divider color={surface.hairline} />

          <Pressable style={styles.row}>
            <IconTile color={palette.green} icon="share-social" />
            <Text style={[styles.rowLabel, {color: surface.text}]}>
              {t('settings.invite', 'Invite a rider')}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={surface.textSoft}
            />
          </Pressable>
        </View>

        <Text style={[styles.footer, {color: surface.textSoft}]}>
          {t('settings.footer', 'Made with care in Colombo 🇱🇰')}
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function IconTile({
  color,
  icon,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.iconTile, {backgroundColor: color}]}>
      <Ionicons name={icon} size={15} color="#FFFFFF" />
    </View>
  );
}

function Divider({color}: {color: string}) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color,
        marginHorizontal: 16,
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  title: {
    ...typography.display,
    fontSize: 34,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  block: {
    marginHorizontal: spacing.lg,
  },

  profileCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.emerald,
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
  },
  profileMeta: {
    fontSize: 12,
    marginTop: 2,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
  },

  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  impactCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  impactNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: palette.emerald,
    letterSpacing: -0.8,
  },
  impactLabel: {
    fontSize: 13,
    color: palette.emerald,
    marginTop: 2,
  },

  footer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
