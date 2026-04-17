import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import {palette, radii, spacing, typography} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';
import {useSettingsStore} from '../../stores/useSettingsStore';
import i18n from '../../i18n';

type LangCode = 'si' | 'ta' | 'en';

const LANGUAGES: ReadonlyArray<{
  code: LangCode;
  native: string;
  roman: string;
  glyph: string;
  accent: string;
}> = [
  {code: 'si', native: 'සිංහල', roman: 'Sinhala', glyph: 'සි', accent: palette.green},
  {code: 'ta', native: 'தமிழ்', roman: 'Tamil', glyph: 'த', accent: palette.amber},
  {code: 'en', native: 'English', roman: 'English', glyph: 'En', accent: '#378ADD'},
];

/**
 * Onboarding — Language (screen 02).
 *
 * Cream page, trilingual title, three large selectable cards. We stay off
 * BlurView here because the page itself is flat cream — the cards are solid
 * cards with a soft emerald ring when selected.
 */
export default function OnboardingLanguage() {
  const {t} = useTranslation();
  const {surface} = useTheme();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const handleSelect = (code: LangCode) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <View style={[styles.container, {backgroundColor: surface.bg}]}>
      <Text style={[styles.title, {color: surface.text}]}>
        {t('onboarding.lang_title', 'Choose your language')}
      </Text>
      <Text style={[styles.subtitle, {color: surface.textDim}]}>
        {t('onboarding.lang_subtitle', 'You can change this anytime in settings.')}
      </Text>

      <View style={styles.options}>
        {LANGUAGES.map((lang) => {
          const selected = language === lang.code;
          return (
            <Pressable
              key={lang.code}
              onPress={() => handleSelect(lang.code)}
              style={({pressed}) => [
                styles.option,
                {
                  backgroundColor: selected
                    ? 'rgba(29,158,117,0.08)'
                    : surface.card,
                  borderColor: selected ? palette.green : surface.hairline,
                  borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                  transform: [{scale: pressed ? 0.98 : 1}],
                },
              ]}>
              <View
                style={[
                  styles.glyphTile,
                  {backgroundColor: surface.bgAlt, borderColor: surface.hairline},
                ]}>
                <Text style={[styles.glyphText, {color: lang.accent}]}>
                  {lang.glyph}
                </Text>
              </View>

              <View style={styles.nameColumn}>
                <Text style={[styles.nativeName, {color: surface.text}]}>
                  {lang.native}
                </Text>
                <Text style={[styles.romanName, {color: surface.textDim}]}>
                  {lang.roman}
                </Text>
              </View>

              {selected ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              ) : (
                <View style={[styles.radio, {borderColor: surface.textSoft}]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: 80,
  },
  title: {
    ...typography.largeTitle,
    marginBottom: 6,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xxxl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
  },
  glyphTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glyphText: {
    fontSize: 20,
    fontWeight: '700',
  },
  nameColumn: {flex: 1},
  nativeName: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  romanName: {
    fontSize: 12,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
});
