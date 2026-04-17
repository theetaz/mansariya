import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import {palette, radii, spacing, typography} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  titleFallback: string;
  bodyKey: string;
  bodyFallback: string;
  accent: string;
  bgToken: 'soft' | 'amberSoft' | 'roadSoft';
};

const STEPS: readonly Step[] = [
  {
    icon: 'navigate-circle-outline',
    titleKey: 'onboarding.step_track_title',
    titleFallback: 'Track',
    bodyKey: 'onboarding.step_track_body',
    bodyFallback: 'Open the map to see buses moving in real time.',
    accent: palette.emerald,
    bgToken: 'soft',
  },
  {
    icon: 'radio-outline',
    titleKey: 'onboarding.step_report_title',
    titleFallback: 'Report',
    bodyKey: 'onboarding.step_report_body',
    bodyFallback: 'Ride with the app open to anonymously share GPS for others.',
    accent: palette.amber,
    bgToken: 'amberSoft',
  },
  {
    icon: 'trophy-outline',
    titleKey: 'onboarding.step_earn_title',
    titleFallback: 'Earn',
    bodyKey: 'onboarding.step_earn_body',
    bodyFallback: 'Climb the leaderboard as you help keep routes honest.',
    accent: '#378ADD',
    bgToken: 'roadSoft',
  },
];

/**
 * Onboarding — How it works (screen 04).
 *
 * Title + three stacked cards: Track / Report / Earn. Each is a soft
 * tinted icon circle with a title and 2-line body. Privacy reassurance at
 * the bottom.
 */
export default function OnboardingHowItWorks() {
  const {t} = useTranslation();
  const {surface} = useTheme();

  const bgFor = (token: Step['bgToken']) => {
    if (token === 'soft') return palette.greenSoft;
    if (token === 'amberSoft') return palette.amberSoft;
    return '#E6F1FB';
  };

  return (
    <View style={[styles.container, {backgroundColor: surface.bg}]}>
      <Text style={[styles.title, {color: surface.text}]}>
        {t('onboarding.how_title', 'How it works')}
      </Text>
      <Text style={[styles.subtitle, {color: surface.textDim}]}>
        {t(
          'onboarding.how_subtitle',
          'Three ways your phone and the network help each other stay on time.',
        )}
      </Text>

      <View style={styles.cards}>
        {STEPS.map((step) => (
          <View
            key={step.titleKey}
            style={[
              styles.card,
              {
                backgroundColor: surface.card,
                borderColor: surface.hairline,
              },
            ]}>
            <View
              style={[
                styles.iconCircle,
                {backgroundColor: bgFor(step.bgToken)},
              ]}>
              <Ionicons name={step.icon} size={22} color={step.accent} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, {color: surface.text}]}>
                {t(step.titleKey, step.titleFallback)}
              </Text>
              <Text style={[styles.cardBody, {color: surface.textDim}]}>
                {t(step.bodyKey, step.bodyFallback)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.privacy,
          {backgroundColor: surface.bgAlt, borderColor: surface.hairline},
        ]}>
        <Ionicons name="lock-closed" size={16} color={surface.textDim} />
        <Text style={[styles.privacyText, {color: surface.textDim}]}>
          {t(
            'onboarding.privacy',
            'Your device is anonymous. No accounts, no tracking between routes.',
          )}
        </Text>
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
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {flex: 1},
  cardTitle: {
    ...typography.title2,
    fontSize: 16,
  },
  cardBody: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
