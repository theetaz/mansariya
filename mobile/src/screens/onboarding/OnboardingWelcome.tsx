import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, typography} from '../../constants/theme';

export default function OnboardingWelcome() {
  const {t} = useTranslation();

  return (
    <View style={styles.container}>
      {/* Hero illustration */}
      <View style={styles.illustrationCircle}>
        <View style={styles.busIcon}>
          <Text style={styles.busEmoji}>🚌</Text>
        </View>
        <View style={styles.locationDot}>
          <View style={styles.locationDotInner} />
        </View>
      </View>

      <Text style={styles.title}>
        {t('onboarding.welcome_title', 'Know when your bus arrives')}
      </Text>
      <Text style={styles.body}>
        {t(
          'onboarding.welcome_body',
          'Real-time bus tracking powered by passengers like you. No hardware needed — just your phone.',
        )}
      </Text>
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
  illustrationCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  busIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  busEmoji: {
    fontSize: 40,
  },
  locationDot: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
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
  },
});
