import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, typography} from '../../constants/theme';
import Button from '../../components/common/Button';
import {requestLocationPermission} from '../../utils/permissions';

interface OnboardingLocationProps {
  onComplete: () => void;
}

export default function OnboardingLocation({onComplete}: OnboardingLocationProps) {
  const {t} = useTranslation();

  const handleAllow = async () => {
    await requestLocationPermission();
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Illustration */}
      <View style={styles.illustrationCircle}>
        <Text style={styles.emoji}>📍</Text>
      </View>

      <Text style={styles.title}>
        {t('onboarding.location_title', 'See buses near you')}
      </Text>
      <Text style={styles.body}>
        {t(
          'onboarding.location_body',
          'Allow location access to show nearby buses and track your ride.',
        )}
      </Text>

      <View style={styles.buttons}>
        <Button
          title={t('onboarding.allow_location', 'Allow location')}
          onPress={handleAllow}
        />
        <Button
          title={t('onboarding.not_now', 'Not now')}
          onPress={onComplete}
          variant="text"
        />
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
  illustrationCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 64,
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
    marginBottom: 40,
  },
  buttons: {
    width: '100%',
    gap: 8,
  },
});
