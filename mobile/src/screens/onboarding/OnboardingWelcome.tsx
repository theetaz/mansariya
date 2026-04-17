import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {LinearGradient} from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import {palette, spacing, typography} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';

/**
 * Onboarding — Welcome (screen 03).
 *
 * Emerald hero gradient at the top with a tilted bus tile + location ring
 * glyph; title and body sit on the cream page beneath.
 */
export default function OnboardingWelcome() {
  const {t} = useTranslation();
  const {isDark, surface} = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: surface.bg}]}>
      <LinearGradient
        colors={
          isDark
            ? [palette.emerald, '#0B1E18']
            : [palette.greenSoft, surface.bg]
        }
        style={styles.hero}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}>
        <View style={styles.glyphWrap}>
          <View style={[styles.busTile, styles.tileShadow]}>
            <Ionicons name="bus" size={56} color="#FFFFFF" />
          </View>
          <View style={styles.locationRing}>
            <View style={styles.locationCore} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.copy}>
        <Text style={[styles.title, {color: surface.text}]}>
          {t('onboarding.welcome_title', 'See every bus in real time.')}
        </Text>
        <Text style={[styles.body, {color: surface.textDim}]}>
          {t(
            'onboarding.welcome_body',
            'Crowdsourced tracking powered by passengers like you. No hardware, no accounts — just your phone.',
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  hero: {
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busTile: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: palette.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{rotate: '-4deg'}],
  },
  tileShadow: {
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 10,
  },
  locationRing: {
    position: 'absolute',
    bottom: 10,
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#378ADD',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#378ADD',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  locationCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  copy: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.largeTitle,
    fontSize: 30,
  },
  body: {
    ...typography.body,
    marginTop: spacing.md,
    lineHeight: 24,
    fontSize: 16,
  },
});
