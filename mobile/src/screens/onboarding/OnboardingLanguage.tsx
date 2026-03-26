import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, typography} from '../../constants/theme';
import {useSettingsStore} from '../../stores/useSettingsStore';
import i18n from '../../i18n';

const LANGUAGES = [
  {code: 'si' as const, script: 'සි', name: 'සිංහල', romanized: 'Sinhala', badgeColor: colors.green},
  {code: 'ta' as const, script: 'த', name: 'தமிழ்', romanized: 'Tamil', badgeColor: colors.amber},
  {code: 'en' as const, script: 'En', name: 'English', romanized: 'English', badgeColor: colors.blue},
];

export default function OnboardingLanguage() {
  const {t} = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const handleSelect = (code: 'si' | 'ta' | 'en') => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('onboarding.lang_title', 'Choose your language')}
      </Text>
      <Text style={styles.subtitle}>
        {t('onboarding.lang_subtitle', 'You can change this anytime in settings')}
      </Text>

      <View style={styles.options}>
        {LANGUAGES.map((lang) => {
          const isSelected = language === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => handleSelect(lang.code)}
              activeOpacity={0.7}>
              {/* Script badge */}
              <View style={[styles.scriptBadge, {backgroundColor: lang.badgeColor + '20'}]}>
                <Text style={[styles.scriptText, {color: lang.badgeColor}]}>
                  {lang.script}
                </Text>
              </View>

              {/* Names */}
              <View style={styles.nameColumn}>
                <Text style={styles.nativeName}>
                  {lang.name}
                </Text>
                <Text style={styles.romanizedName}>
                  {lang.romanized}
                </Text>
              </View>

              {/* Radio */}
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    ...typography.h1,
    color: colors.neutral900,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral500,
    marginBottom: 32,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionSelected: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  scriptBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scriptText: {
    fontSize: 18,
    fontWeight: '700',
  },
  nameColumn: {
    flex: 1,
  },
  nativeName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral900,
  },
  romanizedName: {
    fontSize: 13,
    color: colors.neutral500,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.green,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
  },
});
