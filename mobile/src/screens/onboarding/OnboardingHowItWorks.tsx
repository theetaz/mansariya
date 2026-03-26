import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, typography} from '../../constants/theme';

export default function OnboardingHowItWorks() {
  const {t} = useTranslation();

  return (
    <View style={styles.container}>
      {/* Three-step visual */}
      <View style={styles.stepsRow}>
        <View style={styles.step}>
          <View style={[styles.stepIcon, {backgroundColor: colors.greenLight}]}>
            <Text style={styles.emoji}>🚌</Text>
          </View>
          <Text style={styles.stepLabel}>
            {t('onboarding.step_ride', 'Ride a bus')}
          </Text>
        </View>

        <Text style={styles.arrow}>→</Text>

        <View style={styles.step}>
          <View style={[styles.stepIcon, {backgroundColor: colors.blueLight}]}>
            <Text style={styles.emoji}>📡</Text>
          </View>
          <Text style={styles.stepLabel}>
            {t('onboarding.step_gps', 'GPS shares')}
          </Text>
        </View>

        <Text style={styles.arrow}>→</Text>

        <View style={styles.step}>
          <View style={[styles.stepIcon, {backgroundColor: colors.amberLight}]}>
            <Text style={styles.emoji}>👥</Text>
          </View>
          <Text style={styles.stepLabel}>
            {t('onboarding.step_others', 'Others see it')}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>
        {t('onboarding.how_title', 'Tracked by everyone')}
      </Text>
      <Text style={styles.body}>
        {t(
          'onboarding.how_body',
          'When you ride with the app open, your anonymous GPS helps everyone see where buses are. The more people use it, the better it gets.',
        )}
      </Text>

      {/* Privacy reassurance */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          {t(
            'onboarding.privacy',
            'Your location is anonymous and never stored',
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  step: {
    alignItems: 'center',
  },
  stepIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 28,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral500,
  },
  arrow: {
    fontSize: 20,
    color: colors.green,
    fontWeight: '700',
    marginBottom: 20,
  },
  title: {
    ...typography.h1,
    color: colors.neutral900,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
  },
  body: {
    ...typography.body,
    color: colors.neutral500,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  privacyIcon: {
    fontSize: 18,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral500,
  },
});
