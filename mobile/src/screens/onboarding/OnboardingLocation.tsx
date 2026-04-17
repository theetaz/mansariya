import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import {palette, radii, spacing, typography} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';
import {requestLocationPermission} from '../../utils/permissions';

type OnboardingLocationProps = {
  onComplete: () => void;
};

/**
 * Onboarding — Location permission (screen 05).
 *
 * Emerald pin illustration, reassuring copy, a primary emerald CTA and a
 * ghost "Not now" action. Follows the handoff — no explicit "Allow"
 * native prompt styling, we just invoke the permission request.
 */
export default function OnboardingLocation({onComplete}: OnboardingLocationProps) {
  const {t} = useTranslation();
  const {surface} = useTheme();

  const handleAllow = async () => {
    await requestLocationPermission();
    onComplete();
  };

  return (
    <View style={[styles.container, {backgroundColor: surface.bg}]}>
      <View style={styles.illustration}>
        <View
          style={[styles.haloOuter, {backgroundColor: 'rgba(29,158,117,0.10)'}]}
        />
        <View
          style={[styles.haloInner, {backgroundColor: 'rgba(29,158,117,0.18)'}]}
        />
        <View style={styles.pinTile}>
          <Ionicons name="location" size={44} color="#FFFFFF" />
        </View>
      </View>

      <Text style={[styles.title, {color: surface.text}]}>
        {t('onboarding.location_title', 'Share your location')}
      </Text>
      <Text style={[styles.body, {color: surface.textDim}]}>
        {t(
          'onboarding.location_body',
          "We use it to show nearby buses and, while you ride, to help fellow passengers see the bus you're on.",
        )}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handleAllow}
          style={({pressed}) => [
            styles.primary,
            {transform: [{scale: pressed ? 0.97 : 1}]},
          ]}>
          <Text style={styles.primaryLabel}>
            {t('onboarding.allow_location', 'Allow while using app')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onComplete}
          style={({pressed}) => [
            styles.ghost,
            {opacity: pressed ? 0.7 : 1},
          ]}>
          <Text style={[styles.ghostLabel, {color: surface.textDim}]}>
            {t('onboarding.not_now', 'Not now')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  illustration: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  haloOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  haloInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  pinTile: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{rotate: '-4deg'}],
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    ...typography.largeTitle,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 40,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  primary: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 6,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghost: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
